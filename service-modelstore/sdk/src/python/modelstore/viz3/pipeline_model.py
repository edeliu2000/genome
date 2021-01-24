import logging
import sys

from abc import ABC, abstractmethod
from typing import Mapping, List, Tuple
from numbers import Number

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

"""
    Class to handle pipeline models from sklearn for visualization
"""
class PipelineTree(ABC):

    def __init__(self,
                 pipeline_model,
                 target_name: str = None,
                 class_names: (List[str], Mapping[int, str]) = None):


        self.pipeline_model = pipeline_model
        self.target_name = target_name
        self.class_names = class_names



    @abstractmethod
    def root(self):
        pass


    @abstractmethod
    def leaves(self):
        pass


    def modelGraph( self, precision: int = 2):


        def node_name(node: PipelineNode) -> str:
            return f"pipe{node.id}"


        def node_label(name, node_name, param, minmax=(0,0), isroot=False):
            return f'{node_name}'


        internal = []
        nname = node_name(self.root())
        gr_node = {
          "id": nname,
          "label":  node_label(
                        self.root().name(),
                        nname,
                        param = format(self.root().parameter(), '.' + str(precision) + 'f'),
                        isroot = True),
          "mean": self.root().parameter()
        }

        internal.append(gr_node)


        tree_leaves = []
        for leaf in self.leaves():

            nname_leaf = 'transform%d' % leaf.id
            leaf_label = node_label(nname_leaf, leaf.name(),
              param = format(leaf.parameter(), '.' + str(precision) + 'f'))
            leaf_node = {
              "id": nname_leaf,
              "label": leaf_label,
              "mean": leaf.parameter(),
              "leaf":True
            }
            tree_leaves.append(leaf_node)


        edges = []
        # non leaf edges with > and <=
        nname = node_name(self.root())
        prev_child_name = None
        for i, child in enumerate(self.leaves()):
            if child.isleaf():
                child_node_name = 'transform%d' % child.id


            child_label = ""

            # no connections from leafs to root
            # edges.append(f'{child_node_name} -> {nname} [penwidth={child_pw} arrowType="odot" color="{child_color}" label=<{child_label}>]')
            # don't know if this is needed in dot
            if prev_child_name:
                edges.append({
                  "start": f'{prev_child_name}',
                  "end": f'{child_node_name}',
                  "label": format(child.parameter(), '.' + str(precision) + 'f')
                })

            prev_child_name = child_node_name


        all_nodes = tree_leaves

        vizGraph = {
          "nodes": all_nodes,
          "edges": edges
        }

        return vizGraph





class PipelineSKTree(PipelineTree):


    def __init__(self,
                 pipeline_model,
                 target_name: str = None,
                 class_names: (List[str], Mapping[int, str]) = None):

        super().__init__(pipeline_model,
            target_name=target_name,
            class_names=class_names)

        self.pipeline_model = pipeline_model

        self.pipeline_root = PipelineNode(0, name="+", parameter=1, is_root=True)

        def build_pipeline(pipeline, ind=0):
            index = ind
            for child in pipeline:
                child_class = str(type(child).__name__.split(".")[-1])
                if "Pipeline" in child_class:
                    index = build_pipeline(child, ind=index)
                else:
                  child_node = PipelineNode( index + 1, name=child_class, parameter=1 )
                  self.pipeline_root.add_child(child_node)
                  index = index + 1

            return index


        build_pipeline(pipeline_model)




    def root(self):
        return self.pipeline_root


    def leaves(self):
        return self.pipeline_root.children()




class PipelineNode():

    def __init__(self, id:int, name:str, parameter:float, is_root:bool = False):

        self.id = id
        self.is_root = is_root
        self.node_name = name
        self.param = parameter

        self.node_children = []


    def isroot(self):
        return self.is_root


    def isleaf(self):
        return len(self.node_children) == 0


    def add_child(self, child):
        self.node_children.append(child)


    def children(self):
        return self.node_children


    def name(self):
        return self.node_name


    def parameter(self):
        return self.param
