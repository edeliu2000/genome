FROM python:3.6

#update
RUN apt-get update

#install requirements
COPY ./examples/jobs/ensemble-training/requirements.txt /tmp/requirements.txt
WORKDIR /tmp
RUN pip3 install -r requirements.txt

#copy app
COPY ./examples/jobs/ensemble-training /api
COPY ./modelstore/sdk/src/python/modelstore /api/api/modelstore
WORKDIR /

CMD ["python", "-m", "api.api.model"]
