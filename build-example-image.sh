eval $(minikube docker-env)

docker build -t ensemble-training:local.3 -f ./examples/jobs/ensemble-training/Dockerfile .
