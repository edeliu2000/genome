eval $(minikube docker-env)

docker tag sidecar-kubectl:latest us-west1-docker.pkg.dev/genome-285119/genome/sidecar-kubectl:latest
docker push us-west1-docker.pkg.dev/genome-285119/genome/sidecar-kubectl:latest

docker tag curlimages/curl us-west1-docker.pkg.dev/genome-285119/genome/curlimages-curl:latest
docker push us-west1-docker.pkg.dev/genome-285119/genome/curlimages-curl:latest

docker tag genome-routing:local.1 us-west1-docker.pkg.dev/genome-285119/genome/genome-routing:development
docker push us-west1-docker.pkg.dev/genome-285119/genome/genome-routing:development

docker tag genome-compute:local.1 us-west1-docker.pkg.dev/genome-285119/genome/genome-compute:development
docker push us-west1-docker.pkg.dev/genome-285119/genome/genome-compute:development

docker tag genome-modelstore:local.1 us-west1-docker.pkg.dev/genome-285119/genome/genome-modelstore:development
docker push us-west1-docker.pkg.dev/genome-285119/genome/genome-modelstore:development

docker tag genome-scoring:local.1 us-west1-docker.pkg.dev/genome-285119/genome/genome-scoring:development
docker push us-west1-docker.pkg.dev/genome-285119/genome/genome-scoring:development

docker tag genome-visualizer:local.1 us-west1-docker.pkg.dev/genome-285119/genome/genome-visualizer:development
docker push us-west1-docker.pkg.dev/genome-285119/genome/genome-visualizer:development

docker tag ensemble-training:local.1 us-west1-docker.pkg.dev/genome-285119/genome/ensemble-training:development
docker push us-west1-docker.pkg.dev/genome-285119/genome/ensemble-training:development
