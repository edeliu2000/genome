import logging
import sys

from abc import ABC, abstractmethod
from typing import Mapping, List, Tuple
from numbers import Number

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)


"""
    Class to handle linear models for visualization
"""

class LinearTree(ABC):

    def __init__(self,
                 linear_model,
                 feature_names: List[str] = None,
                 target_name: str = None,
                 class_names: (List[str], Mapping[int, str]) = None):


        self.linear_model = linear_model
        self.feature_names = feature_names
        self.target_name = target_name
        self.class_names = class_names

        self.build()



    @abstractmethod
    def build(self):
        pass


    @abstractmethod
    def root(self):
        pass


    @abstractmethod
    def leaves(self):
        pass

    @abstractmethod
    def model_type(self) -> str:
        """returns model type (linear, logistic)"""
        pass


    def modelGraph(self, precision: int = 2):


        def node_name(node) -> str:
            return f"node{node.id}"


        def node_label(name, node_name, param, minmax=(0,0), isroot=False):
            html = f"""<font face="Helvetica" color="#444443" point-size="12">{name}</font>"""
            htmlTool = f"""{param}"""

            if isroot:
                gr_node = f'{node_name} [margin="0.2, 0.2" shape=none label=<{html}>]'
            else:
                gr_node = f'{node_name} [margin="0.1, 0.1" shape=none tooltip=<{htmlTool}> label=<{html}>]'

            return gr_node


        internal = []
        nname = node_name(self.root())
        gr_node = {
          "id": nname,
          "label": self.root().feature_name(),
          "mean": format(self.root().parameter(), '.' + str(precision) + 'f')
        }


        internal.append(gr_node)


        tree_leaves = []
        for leaf in self.leaves():

            nname_leaf = 'leaf%d' % leaf.id
            leaf_node = {
              "id": nname_leaf,
              "label": leaf.feature_name(),
              "mean": format(self.root().parameter(), '.' + str(precision) + 'f'),
              "leaf": True
            }

            tree_leaves.append(leaf_node)


        edges = []
        # non leaf edges with > and <=
        nname = node_name(self.root())
        prev_child_name = None
        for i, child in enumerate(self.leaves()):

            child_node_name = 'leaf%d' % child.id

            edges.append({
              "start": child_node_name,
              "end": nname,
              "label": child.parameter()
            })



        all_nodes = internal
        all_nodes.extend(tree_leaves)

        vizGraph = {
           "nodes": all_nodes,
           "edges": edges
        }


        if self.model_type():
            vizGraph["model_type"] = self.model_type()


        return vizGraph





class LinearSKTree(LinearTree):


    def __init__(self,
                 linear_model,
                 feature_names: List[str] = None,
                 target_name: str = None,
                 class_names: (List[str], Mapping[int, str]) = None):

        super().__init__(linear_model,
            feature_names=feature_names,
            target_name=target_name,
            class_names=class_names)



    def build(self):
        self.linear_root = TreeNode(0, feature_name="+", parameter=1, is_root=True)

        # this is the SK specific part
        index = 0
        for child in self.linear_model.coef_:
            child = TreeNode( index + 1, feature_name=self.feature_names[index], parameter=child)
            self.linear_root.add_child(child)
            index = index + 1


    # extract also logistic type
    def model_type(self) -> str:
        return "linear"


    def root(self):
        return self.linear_root


    def leaves(self):
        return self.linear_root.children()




class TreeNode():

    def __init__(self, id:int, feature_name:str, parameter:float, is_root:bool = False):

        self.id = id
        self.is_root = is_root
        self.f_name = feature_name
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


    def feature_name(self):
        return self.f_name


    def parameter(self):
        return self.param
