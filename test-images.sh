eval $(minikube docker-env)


#docker build -t genome-modelstore:test.1.1 -f ./service-modelstore/Dockerfile.test .
#docker run --rm genome-modelstore:test.1.1

#docker build -t genome-modelstore-client:test.1.1 -f ./service-modelstore/sdk/src/python/Dockerfile.test .
#docker run --rm genome-modelstore-client:test.1.1

#docker build -t genome-routing:test.1.1 -f ./service-routing/Dockerfile.test .
#docker run --rm genome-routing:test.1.1

docker build -t genome-compute:test.1.1 -f ./service-compute/Dockerfile.test .
docker run --rm genome-compute:test.1.1
