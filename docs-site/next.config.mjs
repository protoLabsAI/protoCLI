import nextra from 'nextra';

const withNextra = nextra({});

// When deploying to GitHub Pages at /protoCLI, set basePath.
// Remove or override BASE_PATH if using a custom domain at the root.
const basePath = process.env.BASE_PATH ?? '/protoCLI';

export default withNextra({
  output: 'export',
  basePath,
  images: {
    unoptimized: true,
  },
});
