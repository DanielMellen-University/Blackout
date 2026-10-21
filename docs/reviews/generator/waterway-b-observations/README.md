# Original timing observation

The first capture-free Waterway Tour seed-9001 flight completes five gates, five nitro refills, the Waterway tour contract with 2,000 points, and a gold runway landing. Its one 116.7 ms interval misses the approximate 100 ms timing target, so it is retained here outside timing acceptance. No raw interval or sample is removed. The complete original source/hook manifest remains in the receipt.

The interval ends at about 5.78 flight seconds during early climb. Nearby one-second samples show main-thread heap falling from about 125 MB to 97 MB, with mesh coverage present. There is no coincident drawing-buffer resize. These observations do not establish a cause or prove a production defect. No heap, terrain, renderer or budget tuning is applied. A separate isolated repeat on identical production source and pilot hashes is recorded under the ordinary waterway-b-full job path; its result is reported separately in the migration and final proof.
