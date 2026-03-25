import type { DependenciesRuntime } from '../types/runtime';

let dependenciesRuntime: DependenciesRuntime = {
  postgres: null,
  redis: null,
  rabbitmq: null,
};

let isRuntimeSet = false;

export function setDependenciesRuntime(
  runtime: Partial<DependenciesRuntime>
): void {
  if (isRuntimeSet) {
    throw new Error('Dependencies runtime has already been set and cannot be modified');
  }
  
  dependenciesRuntime = {
    ...dependenciesRuntime,
    ...runtime,
  };
  
  // Freeze the object to prevent further mutations
  Object.freeze(dependenciesRuntime);
  isRuntimeSet = true;
}

export function getDependenciesRuntime(): DependenciesRuntime {
  return dependenciesRuntime;
}
