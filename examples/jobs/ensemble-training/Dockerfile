FROM openjdk:8-jdk-slim
COPY --from=python:3.8 / /

#update
RUN apt-get update

#install requirements
COPY ./examples/jobs/ensemble-training/requirements.txt /tmp/requirements.txt
WORKDIR /tmp
RUN pip3 install -r requirements.txt

#copy app
COPY ./examples/jobs/ensemble-training /api
COPY ./service-modelstore/sdk/src/python/modelstore /api/api/modelstore
WORKDIR /

CMD ["python", "-m", "api.api.model"]
