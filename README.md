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
# the explanations parameter captures a sample set of precalculated shapley explanations to store and display along with the model
genome_model = GenomeEstimator(forest_model,
      target_classes=["price"],
      feature_names=dataset_train.feature_names,
      explainer=explainer, # the explinaer we created before
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

## Defining Pipelines of Models
To have pipelines with multiple steps and place them on schedule use our pipeline solution, the Sequencer. The Sequencer is part of our compute platform and provides a declarative way via API-s to chain compute images.

#### Example Pipeline Run - sequence of steps:
This is an example of creating a pipeline run of a sequence of three modeling steps. Note the comments:
```
POST http://127.0.0.1:8080/v1.0/genome/compute/sequence/run
```

```javascript

{
    "pipelineName": "pipe-1",
    "canonicalName":"/search/pipe-1",
    "application":"search",
    "steps": [{
    "stepName": "step-1",
    "stepType": "model",
    "parameters":{
      "CA_TRAIN": true
    },
    "datasets":[],
    // the image for model training
    // several env variables are reserved for passing dynamic information
    // like PIPELINE_RUNID, see below for full list
    "image": "ensemble-training:local.3",
    "timeout": "360s",
    "retry": "3"
  },{
    "stepName": "step-2",
    "stepType": "model",
    // set of user defined parameters propagated to the modeling image
    // in the modeling image these parameters are available as an env variable
    // under TRANSFORM_PARAMETERS
    "parameters":{
      "TEXT_TRAIN": true
    },
    "datasets":[],
    "image": "ensemble-training:local.3",
    "timeout": "360s",
    "retry": "3"
  },{
    "stepName": "step-3",
    "stepType": "model",
    "parameters":{
      "IMAGE_TRAIN": true
    },
    "datasets":[],
    "image": "ensemble-training:local.3",
    "timeout": "360s",
    "retry": "3"
  }]
}

```

ENV variables passed to each step container:

-  APPLICATION
-  PIPELINE_RUNID
-  PIPELINE_NAME
-  STEP_NAME
-  STEP_TYPE



#### Example Pipeline Run - sequence of parallel steps:
This is an example of creating a pipeline run of a sequence. The sequence contains a first step, then a set of 2 steps running in parallel, then a last step running after the preceding parallel steps complete:

```
POST http://127.0.0.1:8080/v1.0/genome/compute/sequence/run
```

```json

{
    "pipelineName": "pipe-1",
    "canonicalName":"/search/pipe-1",
    "application":"search",
    "steps": [{
    "stepName": "step-1",
    "stepType": "model",
    "parameters":{
      "CA_TRAIN": true
    },
    "datasets":[],
    "image": "ensemble-training:local.3",
    "timeout": "360s",
    "retry": "3"
  },[{
    "stepName": "step-2a",
    "stepType": "model",
    "parameters":{
      "TEXT_TRAIN_1": true
    },
    "datasets":[],
    "image": "ensemble-training:local.3",
    "timeout": "360s",
    "retry": "3"
  },{
    "stepName": "step-2b",
    "stepType": "model",
    "parameters":{
      "TEXT_TRAIN_2": true
    },
    "datasets":[],
    "image": "ensemble-training:local.3",
    "timeout": "360s",
    "retry": "3"
  }],{
    "stepName": "step-3",
    "stepType": "model",
    "parameters":{
      "IMAGE_TRAIN": true
    },
    "datasets":[],
    "image": "ensemble-training:local.3",
    "timeout": "360s",
    "retry": "3"
  }]
}

```



#### Example Pipeline with Schedule:
This is an example API of creating a pipeline that runs every 6h. Its scheduling a sequence of 3 steps, same as in the first example. The very first schedule is not run immediately but only after the period defined in the API elapses:

```
POST http://127.0.0.1:8080/v1.0/genome/compute/sequence
```

```json

{
    "pipelineName": "pipe-1",
    "canonicalName":"/search/pipe-1",
    "application":"search",
    "schedule": "6h",
    "steps": [{
    "stepName": "step-1",
    "stepType": "model",
    "parameters":{
      "CA_TRAIN": true
    },
    "datasets":[],
    "image": "ensemble-training:local.3",
    "timeout": "360s",
    "retry": "3"
  },{
    "stepName": "step-2",
    "stepType": "model",
    "parameters":{
      "TEXT_TRAIN": true
    },
    "datasets":[],
    "image": "ensemble-training:local.3",
    "timeout": "360s",
    "retry": "3"
  },{
    "stepName": "step-3",
    "stepType": "model",
    "parameters":{
      "IMAGE_TRAIN": true
    },
    "datasets":[],
    "image": "ensemble-training:local.3",
    "timeout": "360s",
    "retry": "3"
  }]
}

```


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
