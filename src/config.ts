import { ConfigProps } from '@/types'
import themes from 'daisyui/src/theming/themes'

const config: ConfigProps = {
	// REQUIRED
	appName: 'Yeshua Academy Finance',
	// REQUIRED: a short description of your app for SEO tags (can be overwritten)
	appDescription:
		'Finance Admin for Yeshua Academy: ledger imports, reconciliation, review queues, and account oversight.',
	// REQUIRED (no https://, not trialing slash at the end, just the naked domain)
	domainName: 'finance.yeshua.academy',
	stripe: {
		// Create multiple products in your Stripe dashboard, then add them here. You can add as many plans as you want, just make sure to add the priceId
		products: [
			{
				type: 'one-time', // one-time, subscription
				title: 'One Time Deal',
				productId: 'prod_T3pFkpyoE0SNMD',
				subtitle: 'Once',
				price: 25,
				isBest: true,
				linkTitle: 'PAY ONE TIME',
				featuresTitle: 'Features',
				priceId: 'price_1S7hauQ6GY0txCDNErDhgmjn',
				features: [
					{
						title: 'Feature 1',
						disabled: false,
					},
					{
						title: 'Feature 2',
						disabled: true,
					},
				],
			},
			{
				type: 'subscription',
				period: 'year',
				productId: 'prod_T3pFJYo1qjQhxD',
				title: 'Year',
				subtitle: 'yearly',
				price: 25,
				linkTitle: 'PAY PER YEAR',
				featuresTitle: 'Features VIP',
				priceId: 'price_1S7hb8Q6GY0txCDNIYng1ClO',
				features: [
					{
						title: 'Feature 1',
						disabled: false,
					},
					{
						title: 'Feature 2',
						disabled: false,
					},
				],
			},
		],
	},
	colors: {
		// REQUIRED — The DaisyUI theme to use (added to the main layout.js). Leave blank for default (light & dark mode). If you any other theme than light/dark, you need to add it in config.tailwind.js in daisyui.themes.
		theme: 'light',
		// REQUIRED — This color will be reflected on the whole app outside of the document (loading bar, Chrome tabs, etc..). By default it takes the primary color from your DaisyUI theme (make sure to update your the theme name after "data-theme=")
		// OR you can just do this to use a custom color: main: "#f37055". HEX only.
		main: themes['light']['primary'],
	},
	resend: {
		// REQUIRED — Email 'From' field to be used when sending other emails, like abandoned carts, updates etc..
		fromAdmin: 'Yeshua Academy Finance <info@yeshua.academy>',
		// Email shown to customer if need support. Leave empty if not needed => if empty, set up Crisp above, otherwise you won't be able to offer customer support."
		supportEmail: 'info@yeshua.academy',
		// When someone replies to supportEmail sent by the app, forward it to the email below (otherwise it's lost). If you set supportEmail to empty, this will be ignored.
		forwardRepliesTo: 'info@yeshua.academy',
		subjects: {
			thankYou: 'Welcome to Yeshua Academy Finance',
		},
	},
}

export default config
