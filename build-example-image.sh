eval $(minikube docker-env)

docker build -t ensemble-training:local.5 -f ./examples/jobs/ensemble-training/Dockerfile .
