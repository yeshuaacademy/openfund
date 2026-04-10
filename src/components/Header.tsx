/*
 * CUSTOM EDITS MADE:
 * 1. Added ButtonSignin to mobile navigation for dashboard access
 * 2. Fixed responsive layout spacing to prevent overlap
 * 3. Improved alignment with items-center classes
 */
'use client'
import { IconButton, Logo } from '@/components'
import ButtonSignin from '@/components/ButtonSignin'
import NavLinks, { NavLink as NavLinkItem } from '@/components/nav-links'
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet'
import { Auth, Demo, Document, Info, Moon, OpenNav, Question, RightArrow, Sun } from '@/icons'
import { ScrollToSection } from '@/utils/scroll-to-section'
import { useUser } from '@/utils/clerkClient'
import { AUTH_ENABLED } from '@/utils/auth'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import type { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type AccessState = 'request' | 'pending' | 'granted'

const deriveAccessState = (user: Record<string, any> | undefined): AccessState => {
	if (!user) return 'request'

	let hasAccess = false
	let pending = false

	const considerStatusString = (value: unknown) => {
		if (typeof value !== 'string') return
		const normalized = value.toLowerCase()
		if (
			normalized.includes('grant') ||
			normalized.includes('approved') ||
			normalized.includes('active') ||
			normalized.includes('ready')
		) {
			hasAccess = true
		}
		if (
			normalized.includes('pending') ||
			normalized.includes('await') ||
			normalized.includes('review')
		) {
			pending = true
		}
	}

	const considerBooleanAccess = (value: unknown) => {
		if (value === true) {
			hasAccess = true
		}
	}

	const considerBooleanPending = (value: unknown) => {
		if (value === true) {
			pending = true
		}
	}

	const metadataSources = ['publicMetadata', 'unsafeMetadata', 'privateMetadata'] as const

	for (const key of metadataSources) {
		const meta = user[key]
		if (!meta || typeof meta !== 'object') continue

		const statusCandidates = [
			meta.accessStatus,
			meta.access_status,
			meta.ledgerStatus,
			meta.ledger_status,
			meta.access_state,
			meta.status,
			meta.fundStatus,
			meta.fund_status,
		]

		statusCandidates.forEach(considerStatusString)

		const accessCandidates = [
			meta.hasLedgerAccess,
			meta.accessGranted,
			meta.access_granted,
			meta.access,
			meta.has_access,
			meta.ledgerAccess,
			meta.ledger_access,
		]

		accessCandidates.forEach(considerBooleanAccess)

		const pendingCandidates = [
			meta.accessPending,
			meta.access_pending,
			meta.pendingAccess,
			meta.pending_access,
			meta.ledgerPending,
			meta.ledger_pending,
		]

		pendingCandidates.forEach(considerBooleanPending)
	}

	if (hasAccess) {
		return 'granted'
	}

	if (pending) {
		return 'pending'
	}

	return 'request'
}

const ThemeSwitch = () => {
	const { resolvedTheme, theme, setTheme } = useTheme()
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	const isDark = ((theme ?? 'system') === 'system' ? resolvedTheme : theme) === 'dark'

	const handleChange = () => {
		if (!mounted) return
		setTheme(isDark ? 'light' : 'dark')
	}

	return (
		<label className='relative inline-flex h-9 w-[68px] items-center rounded-full border border-slate-200 bg-white/80 px-2 shadow-[0_12px_32px_-18px_rgba(15,23,42,0.25)] backdrop-blur-xl transition-colors duration-300 ease-out dark:border-white/10 dark:bg-white/10'>
			<input
				type='checkbox'
				onChange={handleChange}
				checked={mounted ? isDark : false}
				className='peer absolute inset-0 h-full w-full cursor-pointer opacity-0'
				aria-label='Toggle theme'
			/>
			<span className='pointer-events-none flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 transition-colors duration-200 dark:text-slate-200'>
				<Sun />
				<Moon />
			</span>
			<span className='pointer-events-none absolute left-1 top-1 h-7 w-7 rounded-full bg-gradient-to-r from-[#5D5AF6] to-[#24C4FF] shadow-[0_10px_30px_-12px_rgba(36,196,255,0.65)] transition-transform duration-300 ease-out peer-checked:translate-x-[28px]' />
		</label>
	)
}

const MobileNav = ({
	onLogoClick,
	navLinks,
	onRequestAccess,
}: {
	onLogoClick: (event: ReactMouseEvent<HTMLAnchorElement>) => void
	navLinks: NavLinkItem[]
	onRequestAccess: () => void
}) => {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger>
				<div className='flex items-center justify-center rounded-full border border-slate-200 bg-white/80 p-3 text-slate-700 shadow-[0_12px_32px_-18px_rgba(15,23,42,0.25)] backdrop-blur-xl transition-colors duration-200 ease-out dark:border-white/10 dark:bg-white/10 dark:text-white'>
					<OpenNav />
				</div>
			</SheetTrigger>
			<SheetContent className='min-w-[320px] border-l-0 bg-gradient-to-b from-white/95 via-white/90 to-white/80 px-0 pt-4 backdrop-blur-xl dark:from-[#050916]/95 dark:via-[#050916]/92 dark:to-[#050916]/90'>
				<SheetHeader>
					<SheetTitle className='border-b border-white/20 pb-4 pl-6 text-left text-xl font-semibold text-slate-900 dark:border-white/10 dark:text-white'>
						Menu
					</SheetTitle>
				</SheetHeader>
				<Link href='/' onClick={onLogoClick} className='mx-auto mt-8 flex w-fit items-center gap-2'>
					<Logo />
				</Link>
				<div className='mx-auto my-8 w-fit'>
					<NavLinks
						nav_links={navLinks}
						onRequestAccess={() => {
							setIsOpen(false)
							onRequestAccess()
						}}
						onNavigate={() => setIsOpen(false)}
					/>
				</div>
				{/* CUSTOM EDIT: Added ButtonSignin to mobile navigation for dashboard access */}
				<div className='mx-auto mb-8 w-fit'>
					<ButtonSignin />
				</div>
				<div
					role='button'
					tabIndex={0}
					onClick={() => {
						setIsOpen(false)
						onRequestAccess()
					}}
					onKeyDown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault()
							setIsOpen(false)
							onRequestAccess()
						}
					}}
					className='mb-8 mx-auto w-fit outline-none'
				>
					<IconButton text='Open Finance Admin' icon={<RightArrow />} isSubmit={false} />
				</div>
			</SheetContent>
		</Sheet>
	)
}

const Header = () => {
	const router = useRouter()
	const pathname = usePathname()
	const clerkUser = useUser()
	const isSignedIn = AUTH_ENABLED ? clerkUser?.isSignedIn ?? false : true
	const isLoaded = AUTH_ENABLED ? clerkUser?.isLoaded ?? false : true
	const accessState = useMemo<AccessState>(() => {
		if (!isSignedIn || !isLoaded) {
			return 'request'
		}
		return deriveAccessState(clerkUser?.user as Record<string, any> | undefined)
	}, [clerkUser?.user, isLoaded, isSignedIn])

	const navLinks = useMemo<NavLinkItem[]>(() => {
		const base: NavLinkItem[] = [
			{
				id: 'why',
				icon: <Info />,
				title: 'Why',
				link: '/#why',
				sectionId: 'why',
			},
			{
				id: 'what',
				icon: <Document />,
				title: 'What',
				link: '/#what',
				sectionId: 'what',
			},
			{
				id: 'faq',
				icon: <Question />,
				title: 'FAQ',
				link: '/#faq',
				sectionId: 'faq',
			},
		]

		if (!isSignedIn) {
			return [
				...base,
				{
					id: 'access',
					icon: <Auth />,
					title: 'Request Access',
					link: '#request-access',
					action: 'request-access',
				},
			]
		}

		if (accessState === 'pending') {
			return [
				...base,
				{
					id: 'access',
					icon: <Info />,
					title: 'Access Pending',
					link: '#access-pending',
					disabled: true,
				},
			]
		}

		return [
			...base,
			{
				id: 'access',
				icon: <Demo />,
				title: 'App',
				link: '/ledger',
				requiresAuth: true,
			},
		]
	}, [accessState, isSignedIn])

	const [isRequestDialogOpen, setRequestDialogOpen] = useState(false)
	const openRequestAccess = useCallback(() => setRequestDialogOpen(true), [])

	const handleLogoClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
		event.preventDefault()
		if (pathname === '/') {
			window.scrollTo({ top: 0, behavior: 'smooth' })
		} else {
			router.push('/')
		}
	}

  return (
    <header className='fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 backdrop-blur-sm md:px-6 lg:px-8'>
      <div className='relative flex w-full max-w-[1200px] items-center justify-between gap-4 rounded-[28px] border border-slate-200/80 bg-white/80 px-5 py-3 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-2xl transition-colors duration-300 ease-out dark:border-white/10 dark:bg-white/10 dark:shadow-[0_18px_65px_-40px_rgba(49,112,255,0.85)]'>
        <div className='pointer-events-none absolute inset-0 -z-10 rounded-[28px] bg-[radial-gradient(circle_at_top,_rgba(148,163,255,0.22),rgba(255,255,255,0))] opacity-80 blur-3xl dark:opacity-20' />
				<Link href='/' onClick={handleLogoClick}>
					<Logo />
				</Link>
				<div className='hidden lg:block'>
					<NavLinks nav_links={navLinks} onRequestAccess={openRequestAccess} />
				</div>

				{/* CUSTOM EDIT: Fixed responsive layout to prevent overlap */}
				<div className='hidden items-center gap-4 lg:flex'>
					<ThemeSwitch />
					<ButtonSignin />
				</div>

				<div className='flex items-center gap-3 lg:hidden'>
					<ThemeSwitch />
					<MobileNav onLogoClick={handleLogoClick} navLinks={navLinks} onRequestAccess={openRequestAccess} />
				</div>
			</div>
			<RequestAccessDialog open={isRequestDialogOpen} onOpenChange={setRequestDialogOpen} />
	</header>
	)
}

export default Header

const RequestAccessDialog = ({
	open,
	onOpenChange,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
}) => {
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [reason, setReason] = useState('')
	const [submitted, setSubmitted] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	useEffect(() => {
		if (!open) {
			setName('')
			setEmail('')
			setReason('')
			setSubmitted(false)
			setErrorMessage(null)
			setIsSubmitting(false)
		}
	}, [open])

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (isSubmitting) return
		setErrorMessage(null)
		setSubmitted(false)
		setIsSubmitting(true)
		try {
			const response = await fetch('/api/request-access', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, reason }),
			})
			if (!response.ok) {
				throw new Error('Request failed')
			}
			setSubmitted(true)
		} catch (error) {
			console.error('Request access submission failed', error)
			setErrorMessage('We could not submit your request. Please try again shortly.')
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)
	const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)
	const handleReasonChange = (event: ChangeEvent<HTMLTextAreaElement>) => setReason(event.target.value)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-w-lg rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-[0_40px_160px_-80px_rgba(15,23,42,0.5)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#050A18]/95 dark:shadow-[0_40px_160px_-80px_rgba(49,112,255,0.65)]'>
				<DialogHeader className='space-y-2'>
					<DialogTitle className='text-2xl font-semibold text-slate-900 dark:text-white'>Request Access</DialogTitle>
					<DialogDescription className='text-base text-slate-600 dark:text-white/70'>
						Share a few details so we can approve your access quickly.
					</DialogDescription>
				</DialogHeader>
				<form className='mt-6 space-y-5' onSubmit={handleSubmit}>
					<div className='space-y-2'>
						<label htmlFor='request-access-name' className='text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/60'>
							Name
						</label>
						<Input
							id='request-access-name'
							required
							value={name}
							onChange={handleNameChange}
							placeholder='Full name'
							className='h-11 rounded-2xl border-slate-200 bg-white/90 text-slate-700 placeholder:text-slate-400 dark:border-white/15 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/40'
						/>
					</div>
					<div className='space-y-2'>
						<label htmlFor='request-access-email' className='text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/60'>
							Email
						</label>
						<Input
							id='request-access-email'
							type='email'
							required
							value={email}
							onChange={handleEmailChange}
							placeholder='name@organization.org'
							className='h-11 rounded-2xl border-slate-200 bg-white/90 text-slate-700 placeholder:text-slate-400 dark:border-white/15 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/40'
						/>
					</div>
					<div className='space-y-2'>
						<label htmlFor='request-access-reason' className='text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/60'>
							Reason for access
						</label>
						<textarea
							id='request-access-reason'
							required
							value={reason}
							onChange={handleReasonChange}
							placeholder='Let us know why you need access to Finance Admin.'
							className='min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus-visible:border-[#5D5AF6] focus-visible:ring-2 focus-visible:ring-[#5D5AF6]/30 dark:border-white/15 dark:bg-white/5 dark:text-white/80 dark:focus-visible:border-[#5D5AF6] dark:focus-visible:ring-[#5D5AF6]/40'
						/>
					</div>
					<div className='space-y-4 pt-2'>
						<IconButton text='Submit Request' icon={<RightArrow />} isLoading={isSubmitting} />
						{errorMessage && (
							<p className='rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200'>
								{errorMessage}
							</p>
						)}
						{submitted && (
							<p className='rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200'>
								Request submitted. We’ll email you once we review your request.
							</p>
						)}
					</div>
				</form>
			</DialogContent>
		</Dialog>
	)
}
