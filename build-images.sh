eval $(minikube docker-env)

docker build -t sidecar-kubectl:latest ./routing/sidecar

docker build -t genome-routing:local.1.28 -f ./routing/Dockerfile .

docker build -t genome-compute:local.55 -f ./compute/Dockerfile .

docker build -t genome-modelstore:local.1.1.156 -f ./modelstore/Dockerfile .

docker build -t genome-visualizer:local.210 -f ./visualizer/Dockerfile .

docker build -t genome-scoring:local.56 -f ./scoring/Dockerfile .
