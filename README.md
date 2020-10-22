# Genome - Platform for Realtime ML Model Explanations and Inspection
Genome is a cloud native (K8) platform for model explanations and tests, geared towards production grade ML and AI pipelines. It comes with a suite of components that can be used in tandem or isolated to achieve realtime explanations of all model types. It is built on top of scalable technologies that lend themselves well to be operated at large scale in the cloud.

## Vision
Scalable ML Platform for demystifying, dissecting, validating and trusting increasingly complex production AI. We plan to achieve this via:

-  Scalable Realtime Explanations of ML Models
    -  on all types of data (image, text based, tabular)
-  Production grade Tracking and Versioning ML Models and Pipelines
-  Robust test pipelines and flagging of problematic models

## Genome Capabilities
-  Store, Version, Search Models with Model Store
-  Define model and data pipelines with Compute and Sequencer
-  Explain in realtime any model type, in particular:
    -  models working on tabular data (linear, logistic, tree based, ensembles) via SHAP
    -  image based models (CNN architectures) via GradCAM
    -  text based models operating on documents via LIME

-  visualize model internals
    -  linear, logistic model types
    -  trees, forests, ensembles (sklearn, XGBoost, Spark ML)


## Components and Architecture:
-  Genome Model Store - Store and track models
-  Compute and Sequencer - Create run/schedule pipelines
-  Realtime Explainer - Explain Models from Model Store
-  Realtime Visualizer - Visualize Models from Model Store
-  Routing - Routes to correct explainer or visualizer
-  UI - UI for pipelines and models
-  Gateway


## Run Locally:

## Testing:
Tests for our components can be initiated via running
```
test-images.sh
```
To run tests only for specific components disable undesired components in the script above.
