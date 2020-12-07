FROM openjdk:8-jdk-slim
COPY --from=python:3.6 / /

#update
RUN apt-get update

#install requirements
COPY ./service-scoring/requirements.txt /tmp/requirements.txt
WORKDIR /tmp
RUN pip3 install -r requirements.txt

#copy app
COPY ./service-scoring /api
COPY ./service-modelstore/sdk/src/python/modelstore /api/api/modelstore
WORKDIR /

EXPOSE 5000
CMD ["gunicorn", "-w", "1", "-b", ":5000", "-t", "360", "--reload", "api.wsgi:app"]
