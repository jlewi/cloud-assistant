import { FeatureContext, FeatureName, FeatureObserver } from './types';
export declare const FEATURES_CONTEXT_STATE_KEY = "features";
declare function loadState(packageJSON: any, context?: FeatureContext, overrides?: Map<string, boolean>): FeatureObserver;
declare function updateState(featureState$: FeatureObserver, context?: FeatureContext, overrides?: Map<string, boolean>): FeatureObserver;
declare function updateContext<K extends keyof FeatureContext>(featureState$: FeatureObserver | undefined, key: K, value: FeatureContext[K], overrides: Map<string, boolean>): void;
declare function getSnapshot(featureState$: FeatureObserver | undefined): string;
declare function loadSnapshot(snapshot: string): FeatureObserver;
declare function isOn(featureName: FeatureName, featureState$?: FeatureObserver): boolean;
declare const _default: {
    loadState: typeof loadState;
    updateState: typeof updateState;
    updateContext: typeof updateContext;
    getSnapshot: typeof getSnapshot;
    loadSnapshot: typeof loadSnapshot;
    isOn: typeof isOn;
};
export default _default;
