#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#include <dlfcn.h>
#include <string.h>
#include "napi-abi.h"

// Only the companion's own NSWindow is changed. The foreign Codex window is
// read-only. Run inside Electron: a separate probe's connection cannot safely
// manage the companion's window. Resolve private SkyLight APIs at runtime and
// verify membership after every change; unavailable APIs must fail closed.
static int (*mainConnection)(void);
static CFArrayRef (*copySpaces)(int, int, CFArrayRef);
static void (*addToSpaces)(int, CFArrayRef, CFArrayRef);
static void (*removeFromSpaces)(int, CFArrayRef, CFArrayRef);
static CFArrayRef (*copyDisplays)(int);
static bool (*displayIsAnimating)(int, CFStringRef);
static CGError (*windowBounds)(int, uint32_t, CGRect *);
static CGError (*windowIsOrderedIn)(int, uint32_t, bool *);
static CGError (*windowOwner)(int, uint32_t, int *);
static CGError (*connectionPID)(int, pid_t *);
static bool loaded = false;
static bool available = false;

static void *symbol(void *library, const char *modern, const char *legacy) {
    void *result = dlsym(library, modern);
    return result ?: dlsym(library, legacy);
}

static bool loadAPI(void) {
    if (loaded) return available;
    loaded = true;
    void *library = dlopen("/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight", RTLD_LAZY | RTLD_LOCAL);
    if (!library) return false;
    mainConnection = symbol(library, "SLSMainConnectionID", "CGSMainConnectionID");
    copySpaces = symbol(library, "SLSCopySpacesForWindows", "CGSCopySpacesForWindows");
    addToSpaces = symbol(library, "SLSAddWindowsToSpaces", "CGSAddWindowsToSpaces");
    removeFromSpaces = symbol(library, "SLSRemoveWindowsFromSpaces", "CGSRemoveWindowsFromSpaces");
    copyDisplays = symbol(library, "SLSCopyManagedDisplays", "CGSCopyManagedDisplays");
    displayIsAnimating = symbol(library, "SLSManagedDisplayIsAnimating", "CGSManagedDisplayIsAnimating");
    windowBounds = symbol(library, "SLSGetWindowBounds", "CGSGetWindowBounds");
    windowIsOrderedIn = symbol(library, "SLSWindowIsOrderedIn", "CGSWindowIsOrderedIn");
    windowOwner = symbol(library, "SLSGetWindowOwner", "CGSGetWindowOwner");
    connectionPID = symbol(library, "SLSConnectionGetPID", "CGSConnectionGetPID");
    available = mainConnection && copySpaces && addToSpaces && removeFromSpaces
        && copyDisplays && displayIsAnimating && windowBounds && windowIsOrderedIn && windowOwner && connectionPID;
    return available;
}

static NSArray *spacesFor(int connection, uint32_t window) {
    NSArray *windows = @[@(window)];
    // Bit 17 includes ordered-out windows on current macOS. Without it a
    // show:false overlay has no reported membership and can never pass the
    // bind-before-show gate. Keep the user/current/other Space bits (0x7).
    CFArrayRef result = copySpaces(connection, 0x20007, (__bridge CFArrayRef)windows);
    if (!result) return nil;
    NSArray *spaces = CFBridgingRelease(result);
    if (![spaces isKindOfClass:[NSArray class]]) return nil;
    for (id value in spaces) if (![value isKindOfClass:[NSNumber class]] || [value unsignedLongLongValue] == 0) return nil;
    return spaces;
}

static bool sameSpaces(NSArray *a, NSArray *b) {
    return a && b && a.count > 0 && [[NSSet setWithArray:a] isEqualToSet:[NSSet setWithArray:b]];
}

static NSDictionary *syncWindow(NSWindow *overlay, uint32_t host, pid_t expectedPID) {
    if (!loadAPI()) return @{ @"ok": @NO, @"reason": @"skylight-unavailable" };
    int connection = mainConnection();
    CFArrayRef rawDisplays = copyDisplays(connection);
    if (!rawDisplays) return @{ @"ok": @NO, @"reason": @"displays-unavailable" };
    NSArray *displays = CFBridgingRelease(rawDisplays);
    bool animating = false;
    for (NSString *display in displays) animating |= displayIsAnimating(connection, (__bridge CFStringRef)display);
    // Do not retarget, move, hide or remap an already-bound window during the
    // compositor's Space transition. Its existing Space owns its animation.
    if (animating) return @{ @"ok": @YES, @"animating": @YES };

    // IncludingWindow does not make CopyWindowInfo a one-window list: taking
    // firstObject can validate an unrelated frontmost window. Validate the
    // specified window's actual owning connection directly instead.
    int ownerConnection = 0;
    pid_t ownerPID = 0;
    if (windowOwner(connection, host, &ownerConnection) != kCGErrorSuccess
        || connectionPID(ownerConnection, &ownerPID) != kCGErrorSuccess || ownerPID != expectedPID) {
        return @{ @"ok": @NO, @"reason": @"host-window-gone" };
    }
    NSRunningApplication *application = [NSRunningApplication runningApplicationWithProcessIdentifier:expectedPID];
    bool orderedIn = false;
    CGRect bounds = CGRectZero;
    if (!application || application.terminated
        || windowBounds(connection, host, &bounds) != kCGErrorSuccess
        || windowIsOrderedIn(connection, host, &orderedIn) != kCGErrorSuccess) {
        return @{ @"ok": @NO, @"reason": @"host-state-unavailable" };
    }
    if (!isfinite(bounds.origin.x) || !isfinite(bounds.origin.y)
        || !isfinite(bounds.size.width) || !isfinite(bounds.size.height)
        || bounds.size.width < 10 || bounds.size.height < 10) {
        return @{ @"ok": @NO, @"reason": @"invalid-host-bounds" };
    }

    NSWindowCollectionBehavior behavior = overlay.collectionBehavior;
    behavior &= ~(NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorMoveToActiveSpace
        | NSWindowCollectionBehaviorStationary | NSWindowCollectionBehaviorTransient
        | NSWindowCollectionBehaviorFullScreenPrimary | NSWindowCollectionBehaviorFullScreenNone);
    behavior |= NSWindowCollectionBehaviorManaged | NSWindowCollectionBehaviorFullScreenAuxiliary;
    if (overlay.collectionBehavior != behavior) overlay.collectionBehavior = behavior;

    // A show:false BrowserWindow may not yet have a WindowServer ID. Create
    // its backing window invisibly before asking for Space membership.
    if (overlay.windowNumber <= 0) {
        CGFloat previousAlpha = overlay.alphaValue;
        BOOL previousIgnoresMouse = overlay.ignoresMouseEvents;
        overlay.ignoresMouseEvents = YES;
        overlay.alphaValue = 0;
        [overlay orderBack:nil];
        [overlay orderOut:nil];
        overlay.alphaValue = previousAlpha;
        overlay.ignoresMouseEvents = previousIgnoresMouse;
    }
    uint32_t ownWindow = (uint32_t)overlay.windowNumber;
    NSArray *targetSpaces = spacesFor(connection, host);
    NSArray *ownSpaces = spacesFor(connection, ownWindow);
    if (targetSpaces.count == 0 || !ownSpaces) return @{ @"ok": @NO, @"reason": @"spaces-unavailable",
        @"hostWindow": @(host), @"overlayWindow": @(ownWindow),
        @"hostSpaceCount": @(targetSpaces.count), @"overlaySpaceCount": @(ownSpaces.count) };
    if (!sameSpaces(targetSpaces, ownSpaces)) {
        // Hide before altering membership, so a failed/partial bind can never
        // flash on the new desktop. Never move or activate Codex's own window.
        [overlay orderOut:nil];
        NSArray *ownWindows = @[@(ownWindow)];
        NSMutableArray *remove = [ownSpaces mutableCopy];
        [remove removeObjectsInArray:targetSpaces];
        addToSpaces(connection, (__bridge CFArrayRef)ownWindows, (__bridge CFArrayRef)targetSpaces);
        if (remove.count) removeFromSpaces(connection, (__bridge CFArrayRef)ownWindows, (__bridge CFArrayRef)remove);
        ownSpaces = spacesFor(connection, ownWindow);
    }
    if (!sameSpaces(targetSpaces, ownSpaces)) return @{ @"ok": @NO, @"reason": @"space-bind-unverified" };

    // CG/SkyLight coordinates are logical points, including on Retina displays.
    // They are model bounds, not the in-flight Space animation's screen offset.
    return @{
        @"ok": @YES, @"animating": @NO, @"bound": @YES,
        @"visible": @(orderedIn && !application.hidden),
        @"hostWindow": @(host), @"overlayWindow": @(ownWindow),
        @"spaces": [targetSpaces valueForKey:@"stringValue"],
        @"bounds": @{ @"x": @(bounds.origin.x), @"y": @(bounds.origin.y),
            @"width": @(bounds.size.width), @"height": @(bounds.size.height) }
    };
}

static napi_value syncBinding(napi_env env, napi_callback_info context) {
    @autoreleasepool {
        size_t count = 3, length = 0;
        napi_value args[3], result = NULL;
        void *bytes = NULL;
        uint32_t host = 0, pid = 0;
        NSDictionary *state = @{ @"ok": @NO, @"reason": @"invalid-native-arguments" };
        if ([NSThread isMainThread] && napi_get_cb_info(env, context, &count, args, NULL, NULL) == 0 && count == 3
            && napi_get_buffer_info(env, args[0], &bytes, &length) == 0 && length == sizeof(void *)
            && napi_get_value_uint32(env, args[1], &host) == 0 && host > 0
            && napi_get_value_uint32(env, args[2], &pid) == 0 && pid > 0 && pid <= INT32_MAX) {
            uintptr_t view = 0;
            memcpy(&view, bytes, sizeof(view));
            // Validate against owned AppKit views without dereferencing a raw
            // pointer received from JavaScript.
            for (NSWindow *candidate in NSApp.windows) {
                if ((uintptr_t)(__bridge void *)candidate.contentView == view) {
                    @try { state = syncWindow(candidate, host, (pid_t)pid); }
                    @catch (NSException *exception) { state = @{ @"ok": @NO, @"reason": @"native-space-exception" }; }
                    break;
                }
            }
        }
        NSData *json = [NSJSONSerialization dataWithJSONObject:state options:0 error:nil];
        if (!json || napi_create_string_utf8(env, json.bytes, json.length, &result) != 0) return NULL;
        return result;
    }
}

__attribute__((visibility("default"))) int32_t node_api_module_get_api_version_v1(void) { return 3; }
__attribute__((visibility("default"))) napi_value napi_register_module_v1(napi_env env, napi_value exports) {
    napi_value function;
    if (napi_create_function(env, "sync", 4, syncBinding, NULL, &function) != 0
        || napi_set_named_property(env, exports, "sync", function) != 0) return NULL;
    return exports;
}
