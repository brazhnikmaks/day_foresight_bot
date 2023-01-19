export function getRandom(max: number) {
	return Math.floor(Math.random() * max);
}

export function getTimeIcon(time: number): string {
	switch (time) {
		case 1:
		case 13:
			return "🕐";
		case 2:
		case 14:
			return "🕑";
		case 3:
		case 15:
			return "🕒";
		case 4:
		case 16:
			return "🕓";
		case 5:
		case 17:
			return "🕔";
		case 6:
		case 18:
			return "🕕";
		case 7:
		case 19:
			return "🕖";
		case 8:
		case 20:
			return "🕗";
		case 9:
		case 21:
			return "🕘";
		case 10:
		case 22:
			return "🕙";
		case 11:
		case 23:
			return "🕚";
		default:
			return "🕛";
	}
}
