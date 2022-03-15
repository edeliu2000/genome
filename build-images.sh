eval $(minikube docker-env)

docker build --platform linux/amd64 -t sidecar-kubectl:latest ./service-routing/sidecar

docker build --platform linux/amd64 -t genome-routing:local.1 -f ./service-routing/Dockerfile .

docker build --platform linux/amd64 -t genome-compute:local.1 -f ./service-compute/Dockerfile .

docker build --platform linux/amd64 -t genome-modelstore:local.1 -f ./service-modelstore/Dockerfile .

docker build --platform linux/amd64 -t genome-scoring:local.1 -f ./service-scoring/Dockerfile .

docker build --platform linux/amd64 -t genome-visualizer:local.1 -f ./service-visualizer/Dockerfile .

#docker buildx build --platform linux/arm64 -t genome-visualizer:local.1 -f ./service-visualizer/Dockerfile .
