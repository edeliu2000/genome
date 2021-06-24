from ..base import DataRef

import json


class Loaders():

    def get_loader(dataset_type:str):
        if dataset_type == "localdisk":
            return LocalDiskLake()

        elif dataset_type == "s3":
            return S3Lake()

        raise Exception(f"No dataloader four for dataset type: {dataset_type}")




class DataLoader():
    def load(dataset:DataRef):
        pass



class LocalDiskLake(DataLoader):

    def __init__(self):
        self.formats = {
          "json": ""
        }


    def _get_format_and_path(ref: str):

        dataset_format = "json"
        dataset_path = ""
        if dataset.ref[:6] == "json:/"
            dataset_format = "json"
            dataset_path = dataset.ref[6:]
        elif dataset.ref[:6] == "avro:/"
            dataset_format = "avro"
            dataset_path = dataset.ref[6:]
        elif dataset.ref[:9] == "parquet:/"
            dataset_format = "parquet"
            dataset_path = dataset.ref[9:]
        elif dataset.ref[:5] == "csv:/"
            dataset_format = "csv"
            dataset_path = dataset.ref[5:]


        return (dataset_format, dataset_path)


    # avro://, json://, parquet://
    def load(dataset:DataRef):
        dataset_format, dataset_path = self._get_format_and_path(dataset.ref)
        if "json" == dataset_format:
            import json
            return json.load(dataset_path)
        elif "csv" == dataset_format:
            return json.load(dataset_path)






class S3Lake(DataLoader):

    # avro://, json://, parquet://
    def load(dataset:DataRef):
        pass
