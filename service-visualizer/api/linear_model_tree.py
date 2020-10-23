import logging
import sys

from abc import ABC, abstractmethod
from typing import Mapping, List, Tuple
from numbers import Number

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)


from dtreeviz.models.shadow_decision_tree import ShadowDecTree
from dtreeviz.models.shadow_decision_tree import ShadowDecTreeNode
from dtreeviz.models.sklearn_decision_trees import ShadowSKDTree

from dtreeviz.colors import adjust_colors
from dtreeviz.utils import myround

from dtreeviz.trees import DTreeViz

"""
    Class to handle linear models for visualization
"""
class LinearShadowTree(ABC):

    def __init__(self,
                 linear_model,
                 feature_names: List[str] = None,
                 target_name: str = None,
                 class_names: (List[str], Mapping[int, str]) = None):


        self.linear_model = linear_model
        self.feature_names = feature_names
        self.target_name = target_name
        self.class_names = class_names



    @abstractmethod
    def root(self):
        pass


    @abstractmethod
    def leaves(self):
        pass


    def to_dot( self,
      scale=1,
      colors: dict = None,
      precision: int = 2,
      orientation: ('TD', 'LR') = "TD"):


        def node_name(node: ShadowTreeNode) -> str:
            return f"node{node.id}"


        def node_label(name, node_name, param, minmax=(0,0), isroot=False):
            html = f"""<font face="Helvetica" color="#444443" point-size="12">{name}</font>"""
            htmlTool = f"""{param}"""

            if isroot:
                gr_node = f'{node_name} [margin="0.2, 0.2" shape=none label=<{html}>]'
            else:
                gr_node = f'{node_name} [margin="0.1, 0.1" shape=none tooltip=<{htmlTool}> label=<{html}>]'

            return gr_node


        #needs adjust colors
        colors = adjust_colors(colors)

        if orientation == "TD":
            ranksep = ".2"
            nodesep = "0.1"
        else:
            #ranksep = ".05"
            #nodesep = "0.09"
            ranksep = "2.45"
            nodesep = "0.19"


        internal = []
        nname = node_name(self.root())
        gr_node = node_label(
          self.root().feature_name(),
          nname,
          param=myround(self.root().parameter(), precision), isroot=True)
        internal.append(gr_node)


        leaf_min = min([leaf.parameter() for leaf in self.leaves()])
        leaf_max = max([leaf.parameter() for leaf in self.leaves()])


        tree_leaves = []
        for leaf in self.leaves():

            nname_leaf = 'leaf%d' % leaf.id
            leaf_node = node_label(leaf.feature_name(), nname_leaf,
              param=myround(leaf.parameter(), precision),
              minmax=(leaf_min, leaf_max))
            tree_leaves.append(leaf_node)


        edges = []
        # non leaf edges with > and <=
        nname = node_name(self.root())
        prev_child_name = None
        for i, child in enumerate(self.leaves()):
            if child.isleaf():
                child_node_name = 'leaf%d' % child.id


            child_color = "#ffc9ad"
            child_pw = str(0.3 + (15 * (child.parameter() - leaf_min / ((leaf_max - leaf_min) or 1))))

            child_label = ""

            edges.append(f'{child_node_name} -> {nname} [penwidth={child_pw} arrowType="odot" color="{child_color}" label=<{child_label}>]')
            # don't know if this is needed in dot
            if prev_child_name:
                edges.append(f"""
                {{
                    rank=same;
                    {prev_child_name} -> {child_node_name} [style=invis]
                }}
                """)

            prev_child_name = child_node_name




        newline = "\n\t"
        dot = f"""
digraph G {{
    splines=curved;
    nodesep={nodesep};
    ranksep={ranksep};
    rankdir={orientation};
    margin=0.0;
    node [margin="0.03" penwidth="0.5" width=.1, height=.1];
    edge [arrowType="odot" arrowsize=.1 penwidth="0.3"]
    {newline.join(internal)}
    {newline.join(edges)}
    {newline.join(tree_leaves)}
}}
        """


        return DTreeViz(dot, scale)





class LinearSKShadowTree(LinearShadowTree):


    def __init__(self,
                 linear_model,
                 feature_names: List[str] = None,
                 target_name: str = None,
                 class_names: (List[str], Mapping[int, str]) = None):

        super().__init__(linear_model,
            feature_names=feature_names,
            target_name=target_name,
            class_names=class_names)

        self.linear_model = linear_model

        self.linear_root = ShadowTreeNode(0, feature_name="+", parameter=1, is_root=True)

        index = 0
        for child in linear_model.coef_:
            child = ShadowTreeNode( index + 1, feature_name=feature_names[index], parameter=child)
            self.linear_root.add_child(child)
            index = index + 1



    def root(self):
        return self.linear_root


    def leaves(self):
        return self.linear_root.children()




class ShadowTreeNode():

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
