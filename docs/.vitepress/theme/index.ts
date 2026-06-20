// The shared protoLabs.studio theme — VitePress styled from the
// @protolabsai/design tokens. Every studio docs site imports this same theme,
// so the brand stays in one place; change a token, every site restyles.
// See: https://github.com/protoLabsAI/protoContent/tree/main/packages/vitepress-theme
import theme from '@protolabsai/vitepress-theme';
import './custom.css'; // repo-specific tweaks, layered after the theme

export default theme;
