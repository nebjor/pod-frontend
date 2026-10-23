/** Formats a print time in seconds the way the pages show it: "37 min", "1 h 04 min". */
export function formatPrintDuration(totalSeconds: number): string {
    const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
        return `${minutes} min`;
    }

    return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
}
