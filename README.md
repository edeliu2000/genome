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
-  Genome Model Store - API-s to store and track models
-  Compute and Sequencer - API-s to create pipeline runs/schedules
-  Realtime Explainer - API-s to explain models from Model Store
-  Realtime Visualizer - API-s to visualize Models from Model Store
-  Routing - Routes to correct explainer or visualizer
-  Auth - Auth[n|z] for external facing API-s
-  UI - UI for pipelines and models
-  Gateway


## Examples
#### Models on tabular data and explanation
In this example we'll be creating and training a tree based model, specifically a random forest regressor, and then store it in the model store to get realtime explanations out of it.

```python
# using the california housing dataset
dataset_train=fetch_california_housing()

# creating and fitting an sklearn random forest
forest_model = RandomForestRegressor(n_estimators=120,max_depth=5)
forest_model = forest_model.fit(dataset_train.data, dataset_train.target)

# creating the explainer, a shap tree explainer
explainer = shap.TreeExplainer(forest_model)

# creating a genome model with the explainer and with sample explanations
genome_model = GenomeEstimator(forest_model,
      target_classes=["price"],
      feature_names=dataset_train.feature_names,
      explainer=explainer,
      explanations={
          "expected_value": expected_value,
          "shap_values": shap_values,
          "number_labels": number_labels
      })

# save the genome model to model store
modelStore.saveModel(genome_model, {
    "canonicalName": canonicalName,
    "application": application_parameter or "search",
    "pipelineName": pipelinename_parameter or "pipeline-keras-test",
    "pipelineRunId": pipelinerun_parameter,
    "pipelineStage": stepname_parameter or "model",
    "framework": "sklearn",
    "inputModality": "tabular",
    "versionName": "1.2.3"
  })

```


#### Models on images and explanation

#### Models on text and explanation



## Run Locally:

#### Install Docker
Follow instructions on Docker site

#### Install Minikube (Local Kubernetes)
For MacOS run
```
brew install minikube
```
otherwise follow instructions at minikube site: https://minikube.sigs.k8s.io/docs/start/


#### Install Terraform
Follow instructions at terraform site: https://learn.hashicorp.com/tutorials/terraform/install-cli

#### Build Component Images
to build the genome service images run
```
./build-images.sh
```

To have a few example working models run:
```
./build-example-image.sh
```
This will create images for the example folder

#### Running
First do a terraform apply
```
cd terraform/local-test
terraform apply
```

After this the services will be running in minikube. The last step is to port-forward the nginx gateway in minikube to localhost:
```
 kubectl -n local port-forward service/genome-a-nginx-service 8080
```

*Note:* The Genome services will be running in the namespace _local_

Now all services are reachable. Go to the below address in the browser:
```
http://127.0.0.1:8080/static/index.html
```

![Genome Login](resources/img/login-page.png)


## Testing:
To run tests for our components start:
```
./test-images.sh
```
To run tests only for specific components disable undesired components in the script above.
