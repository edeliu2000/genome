from flask import Flask
from .visualizer import visualization_api
from .visualizer import health_api

app = Flask(__name__)

app.register_blueprint(visualization_api)
app.register_blueprint(health_api)

if __name__ == '__main__':
    app.run(host='0.0.0.0')
