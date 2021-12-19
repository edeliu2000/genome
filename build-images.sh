eval $(minikube docker-env)

docker build -t sidecar-kubectl:latest ./service-routing/sidecar

docker build -t genome-routing:local.1 -f ./service-routing/Dockerfile .

docker build -t genome-compute:local.1 -f ./service-compute/Dockerfile .

docker build -t genome-modelstore:local.1 -f ./service-modelstore/Dockerfile .

docker build -t genome-scoring:local.1 -f ./service-scoring/Dockerfile .

docker build -t genome-visualizer:local.1 -f ./service-visualizer/Dockerfile .

#docker buildx build --platform linux/arm64 -t genome-visualizer:local.1 -f ./service-visualizer/Dockerfile .
