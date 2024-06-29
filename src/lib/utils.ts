export const getFormattedDate = (dateString: string) => {
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}