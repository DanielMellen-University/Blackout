# Every captured interval over 100 ms

Times are milliseconds after navigation. These are instrumented runs. Unknown native/scheduling gaps remain explicitly unresolved. Nested spans are not additive.

| Stage / route / run | Phase | Start / end ms | Interval ms | Attribution | GC union ms | Trace covered |
| --- | --- | ---: | ---: | --- | ---: | --- |
| before / city / 1 | startup | 2193.1 / 2476.5 | 283.4 | first-use shader compilation/link/introspection; settlement attachment; layout; cold launch world rebuild | 4.0 | True |
| before / city / 1 | startup | 3776.4 / 3993.1 | 216.7 | unresolved browser/driver/scheduling gap; no dominant captured main-thread phase | 0.0 | True |
| before / city / 1 | flight | 47091.3 / 47241.3 | 150.0 | first-use shader compilation/link/introspection | 1.3 | True |
| before / city / 1 | flight | 75423.6 / 75540.2 | 116.6 | cold synchronous hydrology preparation | 3.5 | True |
| before / city / 1 | flight | 125438.2 / 125688.2 | 250.0 | GC (trace and/or sampled evidence, not summed) | 207.2 | True |
| before / city / 2 | startup | 2351.2 / 2734.5 | 383.3 | first-use shader compilation/link/introspection; settlement attachment; layout; cold launch world rebuild | 5.3 | True |
| before / city / 2 | startup | 3834.5 / 4067.8 | 233.3 | unresolved browser/driver/scheduling gap; no dominant captured main-thread phase | 0.0 | True |
| before / city / 2 | flight | 47332.7 / 47532.7 | 200.0 | first-use shader compilation/link/introspection | 1.5 | True |
| before / city / 2 | flight | 76381.6 / 76498.3 | 116.7 | cold synchronous hydrology preparation | 1.8 | True |
| before / city / 3 | startup | 2395.7 / 2779.0 | 383.3 | first-use shader compilation/link/introspection; settlement attachment; layout; cold launch world rebuild | 3.6 | True |
| before / city / 3 | startup | 2779.0 / 2895.7 | 116.7 | first-use shader compilation/link/introspection | 0.0 | True |
| before / city / 3 | startup | 3828.9 / 4078.9 | 250.0 | unresolved browser/driver/scheduling gap; no dominant captured main-thread phase | 0.0 | True |
| before / city / 3 | flight | 47410.6 / 47593.9 | 183.3 | first-use shader compilation/link/introspection | 1.9 | True |
| before / city / 3 | flight | 77109.3 / 77226.1 | 116.8 | cold synchronous hydrology preparation | 3.0 | True |
| before / world / 1 | startup | 1858.5 / 2058.5 | 200.0 | first-use shader compilation/link/introspection; settlement attachment; layout; cold launch world rebuild | 1.6 | True |
| before / world / 1 | startup | 3775.1 / 4075.1 | 300.0 | unresolved browser/driver/scheduling gap; no dominant captured main-thread phase | 0.0 | True |
| before / world / 1 | startup | 4108.4 / 4225.1 | 116.7 | road attachment | 1.9 | True |
| before / world / 2 | startup | 2972.4 / 3322.4 | 350.0 | first-use shader compilation/link/introspection; settlement attachment; layout; cold launch world rebuild | 10.1 | True |
| before / world / 2 | startup | 3972.4 / 4139.1 | 166.7 | unresolved browser/driver/scheduling gap; no dominant captured main-thread phase | 0.0 | True |
| before / world / 3 | startup | 2486.1 / 2869.4 | 383.3 | first-use shader compilation/link/introspection; settlement attachment; layout; cold launch world rebuild | 7.6 | True |
| before / world / 3 | startup | 3836.1 / 4086.0 | 249.9 | unresolved browser/driver/scheduling gap; no dominant captured main-thread phase | 0.0 | True |
| after / city / 1 | startup | 2048.1 / 2164.8 | 116.7 | unresolved browser/driver/scheduling gap; no dominant captured main-thread phase | 0.0 | True |
| after / city / 1 | startup | 3648.0 / 3914.7 | 266.7 | unresolved browser/driver/scheduling gap; no dominant captured main-thread phase | 0.0 | True |
| after / city / 2 | startup | 2550.4 / 2700.3 | 149.9 | layout | 1.4 | True |
| after / city / 2 | startup | 3850.3 / 4083.6 | 233.3 | unresolved browser/driver/scheduling gap; no dominant captured main-thread phase | 0.0 | True |
| after / city / 3 | startup | 2606.2 / 2772.8 | 166.6 | layout | 0.0 | True |
| after / city / 3 | startup | 3822.9 / 4039.5 | 216.6 | unresolved browser/driver/scheduling gap; no dominant captured main-thread phase | 0.0 | True |
| after / world / 1 | startup | 3629.0 / 3845.7 | 216.7 | unresolved browser/driver/scheduling gap; no dominant captured main-thread phase | 0.0 | True |
| after / world / 2 | startup | 2693.2 / 2809.8 | 116.6 | layout | 0.0 | True |
| after / world / 2 | startup | 3826.5 / 4026.5 | 200.0 | unresolved browser/driver/scheduling gap; no dominant captured main-thread phase | 0.0 | True |
| after / world / 3 | startup | 2660.4 / 2777.2 | 116.8 | layout | 0.0 | True |
| after / world / 3 | startup | 3827.1 / 4043.7 | 216.6 | unresolved browser/driver/scheduling gap; no dominant captured main-thread phase | 0.0 | True |
| after / world / 3 | flight | 103056.5 / 103539.8 | 483.3 | unresolved browser/driver/scheduling gap; no dominant captured main-thread phase | 0.0 | True |
