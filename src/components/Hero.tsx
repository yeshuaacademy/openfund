'use client'

import toolImg from '@/assets/images/tools1.png'
import toolImgDark from '@/assets/images/tools2.png'
import { IconButton } from '@/components'
import { RightArrow } from '@/icons'
import Image from 'next/image'

const avatars: { alt: string; src: string }[] = [
	{
		alt: 'User 1',
		src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
	},
	{
		alt: 'User 2',
		src: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
	},
	{
		alt: 'User 3',
		src: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
	},
	{
		alt: 'User 4',
		src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
	},
	{
		alt: 'User 5',
		src: 'https://images.unsplash.com/photo-1488161628813-04466f872be2?auto=format&fit=crop&w=400&q=80',
	},
]

const TestimonialsAvatars = ({ priority }: { priority?: boolean }) => {
	return (
		<div className='flex flex-col items-start gap-4 sm:flex-row sm:items-center'>
			<div className='flex -space-x-3'>
				{avatars.map((image, i) => (
					<Image
						key={i}
						src={image.src}
						alt={image.alt}
						priority={priority}
						width={52}
						height={52}
						className='inline-block size-12 rounded-full border border-white/40 object-cover shadow-[0_10px_30px_-20px_rgba(49,112,255,0.45)]'
					/>
				))}
			</div>
			<div className='flex flex-col items-start gap-1'>
				<div className='flex'>
					{[...Array(5)].map((_, i) => (
						<svg
							key={i}
							className='size-5 text-[#FED977]'
							fill='currentColor'
							viewBox='0 0 20 20'
							xmlns='http://www.w3.org/2000/svg'
						>
							<path
								fillRule='evenodd'
								d='M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z'
								clipRule='evenodd'
							/>
						</svg>
					))}
				</div>
				<p className='text-sm font-medium text-slate-600 dark:text-white/70'>
					<span className='font-semibold text-slate-900 dark:text-white'>25+</span> finance teams automate reporting
				</p>
			</div>
		</div>
	)
}

const Hero = () => {
	return (
		<section className='relative isolate overflow-hidden px-4 pb-24 pt-28 sm:px-8 lg:px-12'>
			<div className='pointer-events-none absolute inset-0'>
				<div className='absolute left-1/2 top-[-5%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(98,97,255,0.35),_rgba(6,9,24,0))] blur-3xl' />
				<div className='absolute left-[8%] top-[35%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,_rgba(36,196,255,0.25),_rgba(6,9,24,0))] blur-3xl' />
				<div className='absolute right-[-10%] top-[20%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,_rgba(95,76,255,0.18),_rgba(6,9,24,0))] blur-3xl' />
			</div>
			<div className='mx-auto flex w-full max-w-[1200px] flex-col gap-16 lg:flex-row lg:items-center'>
				<div className='relative z-10 w-full max-w-xl space-y-8'>
					<div className='inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-sm backdrop-blur-xl dark:border-white/20 dark:bg-white/10 dark:text-white/70'>
						<span className='inline-flex h-2 w-2 rounded-full bg-[#62f9ff]' />
						Yeshua Academy Finance
					</div>
					<h1 className='text-4xl font-semibold leading-[1.05] text-slate-900 sm:text-5xl lg:text-[3.5rem] dark:text-white'>
						Internal ledger operations,{' '}
						<span className='bg-gradient-to-r from-[#7A7AFF] via-[#61D0FF] to-[#7A7AFF] bg-clip-text text-transparent'>
							reconciliation, and review.
						</span>
					</h1>
					<p className='text-base text-slate-700 sm:text-lg dark:text-white/70'>
						Finance Admin is Yeshua Academy&apos;s internal finance workspace for importing bank
						statements, reconciling accounts, reviewing categorization, and keeping the ledger clean.
					</p>
					<div className='flex flex-col items-start gap-4 sm:flex-row sm:items-center'>
						<div className='w-full sm:w-auto'>
							<IconButton text='Open Finance Admin' icon={<RightArrow />} />
						</div>
						<button className='inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-6 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 ease-out hover:border-slate-300 hover:bg-white dark:border-white/20 dark:bg-white/5 dark:text-white/80 dark:hover:border-white/40 dark:hover:bg-white/10'>
							<span>Request access</span>
							<RightArrow />
						</button>
					</div>
						<p className='text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-white/60'>
							Yeshua Academy internal finance operations
						</p>
					<TestimonialsAvatars priority />
				</div>
				<div className='relative z-10 w-full max-w-[520px]'>
					<div className='relative overflow-hidden rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-[0_50px_140px_-80px_rgba(49,112,255,0.35)] backdrop-blur-2xl before:absolute before:inset-0 before:-z-10 before:bg-[linear-gradient(135deg,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0.05)_100%)] dark:border-white/15 dark:bg-white/10 dark:shadow-[0_50px_140px_-80px_rgba(49,112,255,0.95)]'>
						<div className='absolute -top-16 left-1/2 h-32 w-[70%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(122,122,255,0.55),_rgba(122,122,255,0))] blur-2xl' />
						<Image
							src={toolImg}
							alt='ProChat inspired dashboard'
							width={560}
							height={480}
							priority
							className='relative mx-auto w-full max-w-[460px] rounded-2xl shadow-[0_30px_90px_-40px_rgba(49,112,255,0.4)] dark:hidden'
						/>
						<Image
							src={toolImgDark}
							alt='ProChat inspired dashboard'
							width={560}
							height={480}
							priority
							className='relative mx-auto hidden w-full max-w-[460px] rounded-2xl shadow-[0_30px_90px_-40px_rgba(49,112,255,0.7)] dark:block'
						/>
						<div className='mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2'>
							<div className='rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm backdrop-blur-xl dark:border-white/20 dark:bg-[#060F1F]/90 dark:text-white/85'>
								<p className='text-xs uppercase tracking-[0.3em] text-slate-600 dark:text-white/60'>Import cadence</p>
								<p className='mt-2 text-2xl font-semibold text-slate-900 dark:text-white'>Monthly</p>
							</div>
							<div className='rounded-2xl border border-[#24C4FF]/40 bg-[#24C4FF]/12 px-5 py-4 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xl dark:bg-[#24C4FF]/10 dark:text-white'>
								<p className='text-xs uppercase tracking-[0.3em] text-slate-600 dark:text-white/70'>Primary workspace</p>
								<p className='mt-2 text-2xl font-semibold text-slate-900 dark:text-white'>Ledger</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

export default Hero
