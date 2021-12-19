eval $(minikube docker-env)

docker build -t ensemble-training:local.1 -f ./examples/jobs/ensemble-training/Dockerfile .

#docker build -t ensemble-training:local.tf_arm -f ./examples/jobs/ensemble-training/Dockerfile.arm64 .
