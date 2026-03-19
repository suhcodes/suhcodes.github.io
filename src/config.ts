export const SITE = {
  website: 'https://suhcodes.netlify.app/', // replace with your deployed domain
  author: 'Suh',
  profile: 'https://www.linkedin.com/in/suh-moraes',
  desc: 'A dev blog documenting experiments, builds, and field notes.',
  title: 'suh.codes',
  ogImage: 'public/mylogo.png', // add your OG image to public/ and reference it here
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true,
  editPost: {
    enabled: false,
    text: 'Edit page',
    url: '',
  },
  dynamicOgImage: true,
  dir: 'ltr',
  lang: 'en',
  timezone: 'America/Sao_Paulo', // update to your timezone
} as const
