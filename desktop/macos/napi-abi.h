#pragma once
#include <stddef.h>
#include <stdint.h>

// Small subset of the stable Node-API C ABI. No V8/Electron headers or ABI-
// specific node-gyp download is required to compile this macOS-only module.
// Status 0 is napi_ok; the opaque handles never cross the JS main thread.
typedef struct napi_env__ *napi_env;
typedef struct napi_value__ *napi_value;
typedef struct napi_callback_info__ *napi_callback_info;
typedef napi_value (*napi_callback)(napi_env, napi_callback_info);
extern int napi_get_cb_info(napi_env, napi_callback_info, size_t *, napi_value *, napi_value *, void **);
extern int napi_get_value_uint32(napi_env, napi_value, uint32_t *);
extern int napi_get_buffer_info(napi_env, napi_value, void **, size_t *);
extern int napi_create_string_utf8(napi_env, const char *, size_t, napi_value *);
extern int napi_create_function(napi_env, const char *, size_t, napi_callback, void *, napi_value *);
extern int napi_set_named_property(napi_env, napi_value, const char *, napi_value);
