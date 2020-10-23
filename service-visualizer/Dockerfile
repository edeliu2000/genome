FROM python:3.6

#update
RUN apt-get update

RUN apt install -y graphviz

#install requirements
COPY ./service-visualizer/requirements.txt /tmp/requirements.txt
WORKDIR /tmp
RUN pip3 install -r requirements.txt

#copy app
COPY ./service-visualizer /api
COPY ./service-modelstore/sdk/src/python/modelstore /api/api/modelstore
WORKDIR /

EXPOSE 5000
CMD ["gunicorn", "-w", "1", "-b", ":5000", "-t", "360", "--reload", "api.wsgi:app"]
