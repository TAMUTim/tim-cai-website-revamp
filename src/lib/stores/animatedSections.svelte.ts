let count = $state(0);

export const animatedSections = {
    get count() { return count; },
    set(value: number) { count = value; }
};
