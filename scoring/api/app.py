from flask import Flask
from .classification import classification_api
from .classification import explanation_api

app = Flask(__name__)

app.register_blueprint(classification_api)
app.register_blueprint(explanation_api)

if __name__ == '__main__':
    app.run(host='0.0.0.0')
