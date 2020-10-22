import pandas as pd
import numpy as np

import os
import logging
import sys
import time
import tempfile
from pathlib import Path
from sys import platform as PLATFORM

from typing import Mapping, List, Tuple
from numbers import Number
#from multiprocessing.dummy import Pool
import multiprocessing as mp

import graphviz
import matplotlib
import matplotlib.patches as patches
import matplotlib.pyplot as plt

from dtreeviz.colors import adjust_colors
from dtreeviz.models.shadow_decision_tree import ShadowDecTree
from dtreeviz.models.shadow_decision_tree import ShadowDecTreeNode
from dtreeviz.models.sklearn_decision_trees import ShadowSKDTree
from dtreeviz.models.xgb_decision_tree import ShadowXGBDTree
from dtreeviz.utils import myround
#from dtreeviz.trees import draw_piechart
from dtreeviz.trees import draw_legend
from dtreeviz.trees import get_num_bins
from dtreeviz.trees import DTreeViz
from dtreeviz.trees import class_split_viz
from dtreeviz.trees import regr_split_viz

#matplotlib.use('Agg')

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)


class AsyncPlotter():

    def __init__(self, processes=mp.cpu_count()):

        self.manager = mp.Manager()
        self.nc = self.manager.Value('i', 0)
        self.pids = []
        self.processes = processes

    def async_plotter(self, nc, fig, filename, processes, bbox_inches, pad_inches):
        while nc.value >= processes:
            time.sleep(0.1)
        nc.value += 1
        logging.info("plotting fig: " + filename)
        fig.savefig(filename, bbox_inches=bbox_inches, pad_inches=pad_inches)
        plt.close(fig)
        nc.value -= 1

    def save(self, fig, filename, bbox_inches='tight', pad_inches=0):
        p = mp.Process(target=self.async_plotter,
                       args=(self.nc, fig, filename, self.processes, bbox_inches, pad_inches))
        p.start()
        self.pids.append(p)

    def join(self):
        for p in self.pids:
            p.join()



# XGBoost Booster to dataframe output format
#   Tree  Node    ID                          Feature  Split   Yes    No Missing        Gain     Cover
#0      0     0   0-0                           tenure   17.0   0-1   0-2     0-1  671.161072  1595.500
#1      0     1   0-1      InternetService_Fiber optic    1.0   0-3   0-4     0-3  343.489227   621.125
#2      0     2   0-2      InternetService_Fiber optic    1.0   0-5   0-6     0-5  293.603149   974.375
#3      0     3   0-3                           tenure    4.0   0-7   0-8     0-7   95.604340   333.750
#4      0     4   0-4                     TotalCharges  120.0   0-9  0-10     0-9   27.897919   287.375
#5      0     5   0-5                Contract_Two year    1.0  0-11  0-12    0-11   32.057739   512.625
#6      0     6   0-6                           tenure   60.0  0-13  0-14    0-13  120.693176   461.750
#7      0     7   0-7  TechSupport_No internet service    1.0  0-15  0-16    0-15   37.326447   149.750
#8      0     8   0-8  TechSupport_No internet service    1.0  0-17  0-18    0-17   34.968536   184.000
#9      0     9   0-9                  TechSupport_Yes    1.0  0-19  0-20    0-19    0.766754    65.500
#10     0    10  0-10                MultipleLines_Yes    1.0  0-21  0-22    0-21   19.335510   221.875
#11     0    11  0-11                 PhoneService_Yes    1.0  0-23  0-24    0-23   19.035950   281.125
#12     0    12  0-12                             Leaf    NaN   NaN   NaN     NaN   -0.191398   231.500
#13     0    13  0-13   PaymentMethod_Electronic check    1.0  0-25  0-26    0-25   43.379410   320.875
#14     0    14  0-14                Contract_Two year    1.0  0-27  0-28    0-27   13.401367   140.875
#15     0    15  0-15                             Leaf    NaN   NaN   NaN     NaN    0.050262    94.500
#16     0    16  0-16                             Leaf    NaN   NaN   NaN     NaN   -0.052444    55.250
#17     0    17  0-17                             Leaf    NaN   NaN   NaN     NaN   -0.058929   111.000
#18     0    18  0-18                             Leaf    NaN   NaN   NaN     NaN   -0.148649    73.000
#19     0    19  0-19                             Leaf    NaN   NaN   NaN     NaN    0.161464    63.875



class ShadowSampledXGBDTree(ShadowXGBDTree):
    def __init__(self, booster,
                 tree_index: int,
                 x_data,
                 y_data,
                 feature_names: List[str] = None,
                 target_name: str = None,
                 class_names: (List[str], Mapping[int, str]) = None
                 ):

        super().__init__(booster, tree_index, x_data, y_data, feature_names, target_name, class_names)

        if feature_names == None:
            # checks for n_features attribute in booster or sets n_features to 500
            self.feature_names = ["f{" + str(f) + "}" for f in range(booster.attr("n_features_") or x_data.shape[1] or 500)]

        self.total_leaf_coverage = np.sum(self._get_column_value("Cover")[[node.id for node in self.leaves]])


        def attach_func_n(node):
            node.nsamples = lambda: node.shadow_tree.get_node_nsamples(node.id)

        for node in self.leaves:
            attach_func_n(node)


        self.leaf_s_counts_ = self.get_leaf_sample_counts()

        self.async_plotter = AsyncPlotter(processes=16)



    def get_node_nsamples(self, id):
        node_coverage = self._get_column_value("Cover")[id]
        return node_coverage


    def get_node_impurity(self, id):

        # impurity and gain have a relationship,
        # simply using exp(gain) does make intuitive sense for the reasons below:
        #  - for lower gains, impurity is lower,
        #  - higher gain leads to higher impurity
        #  - negative gain is converted to a positive value by the exp transformation
        # this needs further study to check whether its theoretically correct
        node_gain = self._get_column_value("Gain")[id]
        return np.exp(node_gain)


    def get_prediction_value(self, id):
        all_nodes = self.internal + self.leaves
        if self.is_classifier():
            node_gain = self._get_column_value("Gain")[id]
            class_probability = 1 / (1 + np.exp(-node_gain))
            node_cover = self._get_column_value("Cover")[id]

            return class_probability * node_cover, (1 - class_probability) * node_cover

        elif not self.is_classifier():
            # regression case
            # just spit out leaf values (gains)
            node_gain = self._get_column_value("Gain")[id]
            return node_gain


            #node_samples = [node.samples() for node in all_nodes if node.id == id][0]
            #return np.mean(self.y_data[node_samples])


    def get_leaf_sample_counts(self):
        # cache to speed up rendering of graphviz
        if getattr(self, "leaf_s_counts_", None):
            return self.leaf_s_counts_

        return [np.array([]), self.tree_to_dataframe.query(f"Feature == 'Leaf'")["Cover"].to_numpy()]


    """
    def _get_tree_nodes(self):
        # use locals not args to walk() for recursion speed in python
        leaves = []
        internal = []  # non-leaf nodes
        children_left = self.get_children_left()
        children_right = self.get_children_right()

        def walk(node_id):
            if children_left[node_id] == -1 and children_right[node_id] == -1:  # leaf
                t = ShadowXGBDecTreeNode(self, node_id)
                leaves.append(t)
                return t
            else:  # decision node
                left = walk(children_left[node_id])
                right = walk(children_right[node_id])
                t = ShadowXGBDecTreeNode(self, node_id, left, right)
                internal.append(t)
                return t

        root_node_id = 0
        logging.info("started building tree:")
        root = walk(root_node_id)
        logging.info("ended building tree:")
        return root, leaves, internal
    """


class ShadowXGBDecTreeNode(ShadowDecTreeNode):
    def __init__(self, tree: ShadowDecTree, id: int, left=None, right=None):
        super().__init__(tree, id, left=left, right=right)

    def nsamples(self):
        return self.shadow_tree.get_node_nsamples(self.id)





class ShadowSampledSKDTree(ShadowSKDTree):
    def __init__(self, tree_model,
                 x_data,
                 y_data,
                 feature_names: List[str] = None,
                 target_name: str = None,
                 class_names: (List[str], Mapping[int, str]) = None):

        super().__init__(tree_model, x_data, y_data, feature_names, target_name, class_names)

        if feature_names == None:
            self.feature_names = ["f{" + str(f) + "}" for f in range(tree_model.n_features_)]

        def attach_func_n(node):
            node.nsamples = lambda: node.shadow_tree.get_node_nsamples(node.id)

        for node in self.leaves:
            attach_func_n(node)

        self.leaf_s_counts_ = self.get_leaf_sample_counts()

        self.async_plotter = AsyncPlotter(processes=16)





    def get_node_nsamples(self, id):
        return self.tree_model.tree_.n_node_samples[id]


    def get_node_impurity(self, id):
        return self.tree_model.tree_.impurity[id]


    def get_leaf_sample_counts(self):
        # cache to speed up rendering of graphviz
        if getattr(self, "leaf_s_counts_", None):
            return self.leaf_s_counts_

        return super().get_leaf_sample_counts()




def draw_piechart(node, counts, size, colors, filename, label=None, fontname="Arial", graph_colors=None):
    graph_colors = adjust_colors(graph_colors)
    n_nonzero = np.count_nonzero(counts)

    if n_nonzero != 0:
        i = np.nonzero(counts)[0][0]
        if n_nonzero == 1:
            counts = [counts[i]]
            colors = [colors[i]]

    tweak = size * .01
    fig, ax = plt.subplots(1, 1, figsize=(size, size))
    ax.axis('equal')
    # ax.set_xlim(0 - tweak, size + tweak)
    # ax.set_ylim(0 - tweak, size + tweak)
    ax.set_xlim(0, size - 10 * tweak)
    ax.set_ylim(0, size - 10 * tweak)
    # frame=True needed for some reason to fit pie properly (ugh)
    # had to tweak the crap out of this to get tight box around piechart :(
    wedges, _ = ax.pie(counts, center=(size / 2 - 6 * tweak, size / 2 - 6 * tweak), radius=size / 2, colors=colors,
                       shadow=False, frame=True)
    for w in wedges:
        w.set_linewidth(.5)
        w.set_edgecolor(graph_colors['pie'])

    ax.axis('off')
    ax.xaxis.set_visible(False)
    ax.yaxis.set_visible(False)

    if label is not None:
        ax.text(size / 2 - 6 * tweak, -10 * tweak, label,
                horizontalalignment='center',
                verticalalignment='top',
                fontsize=9, color=graph_colors['text'], fontname=fontname)

    node.shadow_tree.async_plotter.save(fig, filename, bbox_inches='tight', pad_inches=0)

    # plt.tight_layout()
    #plt.savefig(filename, bbox_inches='tight', pad_inches=0)
    #plt.close()




def _class_leaf_viz(node: ShadowDecTreeNode,
                   colors: List[str],
                   filename: str,
                   graph_colors=None):

    start_leaf_time = int(round(time.time() * 1000))

    graph_colors = adjust_colors(graph_colors)

    end_leaf_time = int(round(time.time() * 1000))
    logging.info("timer after piechart colors: " + str(end_leaf_time - start_leaf_time))
    # size = prop_size(node.nsamples(), counts=node.shadow_tree.leaf_sample_counts(),
    #                  output_range=(.2, 1.5))



    minsize = .15
    maxsize = 1.3
    slope = 0.02
    nsamples = node.nsamples()
    size = nsamples * slope + minsize
    size = min(size, maxsize)

    # we visually need n=1 and n=9 to appear different but diff between 300 and 400 is no big deal
    # size = np.sqrt(np.log(size))
    counts = node.class_counts()
    prediction = node.prediction_name()
    draw_piechart(node, counts, size=size, colors=colors, filename=filename, label=f"n={nsamples}\n{prediction}",
                  graph_colors=graph_colors)

    end_leaf_time = int(round(time.time() * 1000))
    logging.info("timer after piechart: " + str(end_leaf_time - start_leaf_time))
    return 1



def _regr_leaf_viz(node: ShadowDecTreeNode,
                  y: (pd.Series, np.ndarray),
                  target_name,
                  filename: str = None,
                  y_range=None,
                  precision=1,
                  label_fontsize: int = 9,
                  ticks_fontsize: str = "small",
                  fontname: str = "Arial",
                  colors=None):

    start_leaf_time = int(round(time.time() * 1000))
    logging.info("start timer : ")


    colors = adjust_colors(colors)

    samples = [] # remove spamples call node.samples()
    y = y[samples]

    end_leaf_time = int(round(time.time() * 1000))
    logging.info("timer after subplot: " + str(end_leaf_time - start_leaf_time))

    # try this to get real training set sample count for this leaf
    num_trained_samples = node.nsamples()

    # try this to get real training set sample count for this leaf
    leaf_impurity = node.shadow_tree.get_node_impurity(node.id)

    tree_leaves_sample_counts = node.shadow_tree.get_leaf_sample_counts()

    # try this to get real training sample count range for this tree
    range_leaf_samples = (min(tree_leaves_sample_counts[1]), max(tree_leaves_sample_counts[1]))
    logging.info("range of leaf sample counts: " + str(range_leaf_samples))


    m = node.prediction()
    end_leaf_time = int(round(time.time() * 1000))
    logging.info("timer after prediction: " + str(end_leaf_time - start_leaf_time))

    if not len(y) > 1:
        # 1) generate samples with normal distribution around the known mean
        #    if given sample count too small.
        #    use mean and impurity of leaf as std_dev
        # 2) scale to a smaller number of samples to visualize
        #    so the browser does not choke on 100k+ svg nodes on big datasets
        sample_fraction = (num_trained_samples - range_leaf_samples[0]) / (range_leaf_samples[1] - range_leaf_samples[0])
        logging.info("leaf sample fraction to show: " + str(sample_fraction))
        size_samples = min(150, int(150 * sample_fraction))
        logging.info("leaf sample size to show: " + str(size_samples))
        y = np.random.normal(1.0, leaf_impurity, size=size_samples) * m if size_samples else np.array([m])



    # y axis centered around mean value for leaf,
    # adding some randomness so the mean bar
    # is placed in visually defferent areas for each leaf
    y_range = (min(y) * 1.03, max(y) * 1.03)

    # y_range = (min(y) * 1.03 - (min(y) * np.random.sample()), max(y) * 1.03 + (abs(min(y)) * np.random.sample()))

    figsize = (.75, .8)
    fig, ax = plt.subplots(1, 1, figsize=figsize)
    ax.tick_params(colors=colors['tick_label'])
    ax.set_ylim(y_range)

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['bottom'].set_visible(False)
    ax.spines['left'].set_linewidth(.3)
    ax.set_xticks([])
    # ax.set_yticks(y_range)

    ticklabelpad = plt.rcParams['xtick.major.pad']
    ax.annotate(f"{target_name}={myround(m, precision)}\nn={num_trained_samples}",
                xy=(.5, 0), xytext=(.5, -.5 * ticklabelpad), ha='center', va='top',
                xycoords='axes fraction', textcoords='offset points',
                fontsize=label_fontsize, fontname=fontname, color=colors['axis_label'])

    ax.tick_params(axis='y', which='major', width=.3, labelcolor=colors['tick_label'], labelsize=ticks_fontsize)

    end_leaf_time = int(round(time.time() * 1000))
    logging.info("timer after tick: " + str(end_leaf_time - start_leaf_time))


    mu = .5
    sigma = .08
    X = np.random.normal(mu, sigma, size=len(y))
    ax.set_xlim(0, 1)
    alpha = colors['scatter_marker_alpha']  # was .25

    ax.plot(X, y, '.', markersize=5, c=colors['scatter_marker'], alpha=alpha, linewidth=.3)
    ax.plot([0, len(y)], [m, m], '--', color=colors['split_line'], linewidth=1)

    end_leaf_time = int(round(time.time() * 1000))
    logging.info("timer after scatter plot: " + str(end_leaf_time - start_leaf_time))

    # plt.tight_layout()
    if filename is not None:
        node.shadow_tree.async_plotter.save(fig, filename, bbox_inches='tight', pad_inches=0)

        #plt.savefig(filename, bbox_inches='tight', pad_inches=0)
        #plt.close()

    end_leaf_time = int(round(time.time() * 1000))
    logging.info("timer after save: " + str(end_leaf_time - start_leaf_time))
    return 1






def dtreeviz(tree_model,
             x_data: (pd.DataFrame, np.ndarray) = None,
             y_data: (pd.DataFrame, np.ndarray) = None,
             feature_names: List[str] = None,
             target_name: str = None,
             class_names: (Mapping[Number, str], List[str]) = None,  # required if classifier,
             tree_index: int = None,  # required in case of tree ensemble,
             precision: int = 2,
             orientation: ('TD', 'LR') = "TD",
             instance_orientation: ("TD", "LR") = "LR",
             show_root_edge_labels: bool = True,
             show_node_labels: bool = False,
             show_just_path: bool = False,
             fancy: bool = True,
             histtype: ('bar', 'barstacked', 'strip') = 'barstacked',
             highlight_path: List[int] = [],
             X: np.ndarray = None,
             max_X_features_LR: int = 10,
             max_X_features_TD: int = 20,
             label_fontsize: int = 12,
             ticks_fontsize: int = 8,
             fontname: str = "Arial",
             colors: dict = None,
             scale=1.0
             ) \
        -> DTreeViz:
    """
    Given a decision tree regressor or classifier, create and return a tree visualization
    using the graphviz (DOT) language.
    We can call this function in two ways :
    1. by using shadow tree
        ex. dtreeviz(shadow_dtree)
        - we need to initialize shadow_tree before this call
            - ex. shadow_dtree = ShadowSKDTree(tree_model, dataset[features], dataset[target], features, target, [0, 1]))
        - the main advantage is that we can use the shadow_tree for other visualisations methods as well
    2. by using sklearn, xgboost tree
        ex. dtreeviz(tree_model, dataset[features], dataset[target], features, target, class_names=[0, 1])
        - maintain backward compatibility
    :param tree_model: A DecisionTreeRegressor or DecisionTreeClassifier that has been
                       fit to X_train, y_data.
    :param X_train: A data frame or 2-D matrix of feature vectors used to train the model.
    :param y_data: A pandas Series or 1-D vector with target values or classes.
    :param feature_names: A list of the feature names.
    :param target_name: The name of the target variable.
    :param class_names: [For classifiers] A dictionary or list of strings mapping class
                        value to class name.
    :param precision: When displaying floating-point numbers, how many digits to display
                      after the decimal point. Default is 2.
    :param orientation:  Is the tree top down, "TD", or left to right, "LR"?
    :param instance_orientation: table orientation (TD, LR) for showing feature prediction's values.
    :param show_root_edge_labels: Include < and >= on the edges emanating from the root?
    :param show_node_labels: Add "Node id" to top of each node in graph for educational purposes
    :param show_just_path: If True, it shows only the sample(X) prediction path
    :param fancy:
    :param histtype: [For classifiers] Either 'bar' or 'barstacked' to indicate
                     histogram type. We find that 'barstacked' looks great up to about.
                     four classes.
    :param highlight_path: A list of node IDs to highlight, default is [].
                           Useful for emphasizing node(s) in tree for discussion.
                           If X argument given then this is ignored.
    :type highlight_path: List[int]
    :param X: Instance to run down the tree; derived path to highlight from this vector.
              Show feature vector with labels underneath leaf reached. highlight_path
              is ignored if X is not None.
    :type X: np.ndarray
    :param label_fontsize: Size of the label font
    :param ticks_fontsize: Size of the tick font
    :param fontname: Font which is used for labels and text
    :param max_X_features_LR: If len(X) exceeds this limit for LR layout,
                            display only those features
                           used to guide X vector down tree. Helps when len(X) is large.
                           Default is 10.
    :param max_X_features_TD: If len(X) exceeds this limit for TD layout,
                            display only those features
                           used to guide X vector down tree. Helps when len(X) is large.
                           Default is 25.
    :param scale: Default is 1.0. Scale the width, height of the overall SVG preserving aspect ratio
    :return: A string in graphviz DOT language that describes the decision tree.
    """

    def node_name(node: ShadowDecTreeNode) -> str:
        return f"node{node.id}"

    def split_node(name, node_name, split):
        if fancy:
            labelgraph = node_label(node) if show_node_labels else ''
            html = f"""<table border="0">
            {labelgraph}
            <tr>
                    <td><img src="{tmp}/node{node.id}_{os.getpid()}.svg"/></td>
            </tr>
            </table>"""
        else:
            html = f"""<font face="Helvetica" color="#444443" point-size="12">{name}@{split}</font>"""
        if node.id in highlight_path:
            gr_node = f'{node_name} [margin="0" shape=box penwidth=".5" color="{colors["highlight"]}" style="dashed" label=<{html}>]'
        else:
            gr_node = f'{node_name} [margin="0" shape=none label=<{html}>]'
        return gr_node

    def regr_leaf_node(node, label_fontsize: int = 12):
        # always generate fancy regr leaves for now but shrink a bit for nonfancy.
        labelgraph = node_label(node) if show_node_labels else ''
        html = f"""<table border="0">
        {labelgraph}
        <tr>
                <td><img src="{tmp}/leaf{node.id}_{os.getpid()}.svg"/></td>
        </tr>
        </table>"""
        if node.id in highlight_path:
            return f'leaf{node.id} [margin="0" shape=box penwidth=".5" color="{colors["highlight"]}" style="dashed" label=<{html}>]'
        else:
            return f'leaf{node.id} [margin="0" shape=box penwidth="0" color="{colors["text"]}" label=<{html}>]'

    def class_leaf_node(node, label_fontsize: int = 12):
        labelgraph = node_label(node) if show_node_labels else ''
        html = f"""<table border="0" CELLBORDER="0">
        {labelgraph}
        <tr>
                <td><img src="{tmp}/leaf{node.id}_{os.getpid()}.svg"/></td>
        </tr>
        </table>"""
        if node.id in highlight_path:
            return f'leaf{node.id} [margin="0" shape=box penwidth=".5" color="{colors["highlight"]}" style="dashed" label=<{html}>]'
        else:
            return f'leaf{node.id} [margin="0" shape=box penwidth="0" color="{colors["text"]}" label=<{html}>]'

    def node_label(node):
        return f'<tr><td CELLPADDING="0" CELLSPACING="0"><font face="Helvetica" color="{colors["node_label"]}" point-size="14"><i>Node {node.id}</i></font></td></tr>'

    def class_legend_html():
        return f"""
        <table border="0" cellspacing="0" cellpadding="0">
            <tr>
                <td border="0" cellspacing="0" cellpadding="0"><img src="{tmp}/legend_{os.getpid()}.svg"/></td>
            </tr>
        </table>
        """

    def class_legend_gr():
        if not shadow_tree.is_classifier():
            return ""
        return f"""
            subgraph cluster_legend {{
                style=invis;
                legend [penwidth="0" margin="0" shape=box margin="0.03" width=.1, height=.1 label=<
                {class_legend_html()}
                >]
            }}
            """

    def instance_html(path, instance_fontsize: int = 11):
        headers = []
        features_used = [node.feature() for node in path[:-1]]  # don't include leaf
        display_X = X
        display_feature_names = shadow_tree.feature_names
        highlight_feature_indexes = features_used
        if (orientation == 'TD' and len(X) > max_X_features_TD) or \
                (orientation == 'LR' and len(X) > max_X_features_LR):
            # squash all features down to just those used
            display_X = [X[i] for i in features_used] + ['...']
            display_feature_names = [node.feature_name() for node in path[:-1]] + ['...']
            highlight_feature_indexes = range(0, len(features_used))

        for i, name in enumerate(display_feature_names):
            if i in highlight_feature_indexes:
                color = colors['highlight']
            else:
                color = colors['text']
            headers.append(f'<td cellpadding="1" align="right" bgcolor="white">'
                           f'<font face="Helvetica" color="{color}" point-size="{instance_fontsize}">'
                           f'{name}'
                           '</font>'
                           '</td>')

        values = []
        for i, v in enumerate(display_X):
            if i in highlight_feature_indexes:
                color = colors['highlight']
            else:
                color = colors['text']
            if isinstance(v, int) or isinstance(v, str):
                disp_v = v
            else:
                disp_v = myround(v, precision)
            values.append(f'<td cellpadding="1" align="right" bgcolor="white">'
                          f'<font face="Helvetica" color="{color}" point-size="{instance_fontsize}">{disp_v}</font>'
                          '</td>')

        if instance_orientation == "TD":
            html_output = """<table border="0" cellspacing="0" cellpadding="0">"""
            for header, value in zip(headers, values):
                html_output += f"<tr> {header} {value} </tr>"
            html_output += "</table>"
            return html_output
        else:
            return f"""
                <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                    {''.join(headers)}
                </tr>
                <tr>
                    {''.join(values)}
                </tr>
                </table>
                """

    def instance_gr():
        if X is None:
            return ""
        pred, path = shadow_tree.predict(X)
        # print(f"path {[node.feature_name() for node in path]}")
        # print(f"path id {[node.id() for node in path]}")
        # print(f"path prediction {[node.prediction() for node in path]}")

        leaf = f"leaf{path[-1].id}"
        if shadow_tree.is_classifier():
            edge_label = f" &#160;Prediction<br/> {path[-1].prediction_name()}"
        else:
            edge_label = f" &#160;Prediction<br/> {myround(path[-1].prediction(), precision)}"
        return f"""
            subgraph cluster_instance {{
                style=invis;
                X_y [penwidth="0.3" margin="0" shape=box margin="0.03" width=.1, height=.1 label=<
                {instance_html(path)}
                >]
            }}
            {leaf} -> X_y [dir=back; penwidth="1.2" color="{colors['highlight']}" label=<<font face="Helvetica" color="{colors['leaf_label']}" point-size="{11}">{edge_label}</font>>]
            """

    def get_internal_nodes():
        if show_just_path and X is not None:
            _internal = []
            for _node in shadow_tree.internal:
                if _node.id in highlight_path:
                    _internal.append(_node)
            return _internal
        else:
            return shadow_tree.internal

    def get_leaves():
        if show_just_path and X is not None:
            _leaves = []
            for _node in shadow_tree.leaves:
                if _node.id in highlight_path:
                    _leaves.append(_node)
                    break
            return _leaves
        else:
            return shadow_tree.leaves

    shadow_tree = ShadowDecTree.get_shadow_tree(tree_model, x_data, y_data, feature_names, target_name, class_names,
                                                tree_index)
    colors = adjust_colors(colors)

    if orientation == "TD":
        ranksep = ".2"
        nodesep = "0.1"
    else:
        if fancy:
            ranksep = ".22"
            nodesep = "0.1"
        else:
            ranksep = ".05"
            nodesep = "0.09"

    tmp = tempfile.gettempdir()
    if X is not None:
        pred, path = shadow_tree.predict(X)
        highlight_path = [n.id for n in path]

    n_classes = shadow_tree.nclasses()
    color_values = colors['classes'][n_classes]

    # Fix the mapping from target value to color for entire tree
    if shadow_tree.is_classifier():
        class_values = shadow_tree.classes()
        color_map = {v: color_values[i] for i, v in enumerate(class_values)}
        draw_legend(shadow_tree, shadow_tree.target_name, f"{tmp}/legend_{os.getpid()}.svg", colors=colors)

    X_data = shadow_tree.x_data
    y_data = shadow_tree.y_data
    if isinstance(X_data, pd.DataFrame):
        X_data = X_data.values
    if isinstance(y_data, pd.Series):
        y_data = y_data.values
    if y_data.dtype == np.dtype(object):
        try:
            y_data = y_data.astype('float')
        except ValueError as e:
            raise ValueError('y_data needs to consist only of numerical values. {}'.format(e))
        if len(y_data.shape) != 1:
            raise ValueError('y_data must a one-dimensional list or Pandas Series, got: {}'.format(y_data.shape))

    y_range = (min(y_data) * 1.03, max(y_data) * 1.03)  # same y axis for all

    # Find max height (count) for any bar in any node
    if shadow_tree.is_classifier():
        nbins = get_num_bins(histtype, n_classes)
        node_heights = shadow_tree.get_split_node_heights(X_data, y_data, nbins=nbins)

    internal = []
    for node in get_internal_nodes():
        if fancy:
            if shadow_tree.is_classifier():
                class_split_viz(node, X_data, y_data,
                                filename=f"{tmp}/node{node.id}_{os.getpid()}.svg",
                                precision=precision,
                                colors={**color_map, **colors},
                                histtype=histtype,
                                node_heights=node_heights,
                                X=X,
                                ticks_fontsize=ticks_fontsize,
                                label_fontsize=label_fontsize,
                                fontname=fontname,
                                highlight_node=node.id in highlight_path)
            else:

                regr_split_viz(node, X_data, y_data,
                               filename=f"{tmp}/node{node.id}_{os.getpid()}.svg",
                               target_name=shadow_tree.target_name,
                               y_range=y_range,
                               precision=precision,
                               X=X,
                               ticks_fontsize=ticks_fontsize,
                               label_fontsize=label_fontsize,
                               fontname=fontname,
                               highlight_node=node.id in highlight_path,
                               colors=colors)

        nname = node_name(node)
        gr_node = split_node(node.feature_name(), nname, split=myround(node.split(), precision))
        internal.append(gr_node)

    leaves = []

    #process each leave in a thread and see if it works
    #pool = Pool(2)

    if shadow_tree.is_classifier():

        leaves_viz_tasks = [
          (node, color_values,
          f"{tmp}/leaf{node.id}_{os.getpid()}.svg", colors
        ) for node in get_leaves()]

        #pool.starmap(_class_leaf_viz, leaves_viz_tasks)
        [_class_leaf_viz(*n) for n in leaves_viz_tasks]
        for node in get_leaves():
            leaves.append(class_leaf_node(node))

        shadow_tree.async_plotter.join()

    else:
        start_time_all = int(round(time.time() * 1000))
        logging.info("starting leaves display: " + str(start_time_all))

        leaves_viz_tasks = [
          (node, y_data, shadow_tree.target_name,
          f"{tmp}/leaf{node.id}_{os.getpid()}.svg", y_range,
          precision, "small", label_fontsize, fontname, colors
         ) for node in get_leaves()]

        #pool.starmap(_regr_leaf_viz, leaves_viz_tasks)
        [_regr_leaf_viz(*n) for n in leaves_viz_tasks]
        for node in get_leaves():
            leaves.append(regr_leaf_node(node))

        shadow_tree.async_plotter.join()
        end_time_all = int(round(time.time() * 1000))
        logging.info("### all leaves displayed: " + str(end_time_all - start_time_all))



    if show_just_path:
        show_root_edge_labels = False
    show_edge_labels = False
    all_llabel = '&lt;' if show_edge_labels else ''
    all_rlabel = '&ge;' if show_edge_labels else ''
    root_llabel = '&lt;' if show_root_edge_labels else ''
    root_rlabel = '&ge;' if show_root_edge_labels else ''

    edges = []
    # non leaf edges with > and <=
    for node in get_internal_nodes():
        nname = node_name(node)
        if node.left.isleaf():
            left_node_name = 'leaf%d' % node.left.id
        else:
            left_node_name = node_name(node.left)
        if node.right.isleaf():
            right_node_name = 'leaf%d' % node.right.id
        else:
            right_node_name = node_name(node.right)

        if node == shadow_tree.root:
            llabel = root_llabel
            rlabel = root_rlabel
        else:
            llabel = all_llabel
            rlabel = all_rlabel

        lcolor = rcolor = colors['arrow']
        lpw = rpw = "0.3"
        if node.left.id in highlight_path:
            lcolor = colors['highlight']
            lpw = "1.2"
        if node.right.id in highlight_path:
            rcolor = colors['highlight']
            rpw = "1.2"

        if show_just_path:
            if node.left.id in highlight_path:
                edges.append(f'{nname} -> {left_node_name} [penwidth={lpw} color="{lcolor}" label=<{llabel}>]')
            if node.right.id in highlight_path:
                edges.append(f'{nname} -> {right_node_name} [penwidth={rpw} color="{rcolor}" label=<{rlabel}>]')
        else:
            edges.append(f'{nname} -> {left_node_name} [penwidth={lpw} color="{lcolor}" label=<{llabel}>]')
            edges.append(f'{nname} -> {right_node_name} [penwidth={rpw} color="{rcolor}" label=<{rlabel}>]')
            edges.append(f"""
            {{
                rank=same;
                {left_node_name} -> {right_node_name} [style=invis]
            }}
            """)

    newline = "\n\t"
    dot = f"""
digraph G {{
    splines=line;
    nodesep={nodesep};
    ranksep={ranksep};
    rankdir={orientation};
    margin=0.0;
    node [margin="0.03" penwidth="0.5" width=.1, height=.1];
    edge [arrowsize=.4 penwidth="0.3"]
    {newline.join(internal)}
    {newline.join(edges)}
    {newline.join(leaves)}
    {class_legend_gr()}
    {instance_gr()}
}}
    """

    return DTreeViz(dot, scale)
