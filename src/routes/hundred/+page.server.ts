import type {PageServerLoad} from "./$types";

export const load: PageServerLoad = async({ url }) => {
	const module = import.meta.glob('/src/lib/hundred/*.svelte');

	const hundredPromises = Object.entries(module).map(([path, resolver]) =>
		resolver().then(
			(post) => ({
				title: path.match(/([\w-]+)\.(svelte)/i)?.[1] ?? 'empty'
			})
		)
	);

	const hundredTitles = await Promise.all(hundredPromises);
	const parsedTitles = hundredTitles.map((hundredTitle, index) =>
		hundredTitle.title.replace(/_/g, ' ')
	);

	return {
		titles: parsedTitles
	};
}