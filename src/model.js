import * as tf from '@tensorflow/tfjs';

export class RLModel {
    constructor(hiddenLayerSizes, numStates, numActions, batchSize) {
        this.numStates = numStates;
        this.numActions = numActions;
        this.batchSize = batchSize;

        if (hiddenLayerSizes instanceof tf.LayersModel()) {
            this.network = hiddenLayerSizes;
            this.network.summary();
            this.network.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
        }
        else {
            this.defineModel(hiddenLayerSizes);
        }
    }

    defineModel(hiddenLayerSizes) {
        if(!Array.isArray(hiddenLayerSizes)) {
            hiddenLayerSizes = [hiddenLayerSizes];
        }
        this.network = tf.sequential();
        hiddenLayerSizes.forEach((hiddenLayerSize, i) => {
            this.network.add(tf.layers.dense({
                units: hiddenLayerSize,
                activation: 'relu',
                inputShape: i === 0 ? [this.numStates] : undefined,
            }));
        });
        this.network.add(tf.layers.dense({ units: this.numActions }));

        this.network.summary();
        this.network.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
    }
}