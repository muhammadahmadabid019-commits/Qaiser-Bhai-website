const fs = require('fs');

let css = fs.readFileSync('public/style.css', 'utf8');

// Colors
css = css.replace(/#061B3A/gi, '#061A36'); // Main background
css = css.replace(/rgba\(6,27,58/gi, 'rgba(6,26,54'); // Main background rgba
css = css.replace(/#0A2347/gi, '#082044'); // Section alt
css = css.replace(/#0D2A52/gi, '#082044'); // Another background shade
css = css.replace(/#102F5A/gi, '#102F59'); // Card shade
css = css.replace(/#e52e2e/gi, '#D62828');
css = css.replace(/rgba\(229,46,46/gi, 'rgba(214,40,40');
css = css.replace(/#ff5252/gi, '#D62828');
css = css.replace(/#b91c1c/gi, '#991B1B');

// Navbar
css = css.replace(/#mainNavbar \{[\s\S]*?\}/, `#mainNavbar {
  background: #F7F8FA;
  border-bottom: 1px solid rgba(214,40,40,0.3);
  padding: 14px 0;
  transition: all 0.3s ease;
}`);

css = css.replace(/#mainNavbar\.scrolled \{[\s\S]*?\}/, `#mainNavbar.scrolled {
  background: #F7F8FA;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  padding: 8px 0;
}`);

css = css.replace(/\.navbar-brand \{[\s\S]*?\}/, `.navbar-brand {
  font-size: 1.4rem;
  font-weight: 800;
  color: #0B2345 !important;
  display: inline-flex;
  align-items: center;
}`);

css = css.replace(/\.nav-link \{[\s\S]*?\}/, `.nav-link {
  color: #0B2345 !important;
  font-weight: 500;
  padding: 6px 14px !important;
  border-radius: 6px;
  transition: color 0.3s;
}`);

// mobile menu background
css = css.replace(/background: rgba\(15,54,100,0\.99\);/g, 'background: #F7F8FA;');

// text contrast improvements
// secondary text #7a92b0 -> #D8E5F3 where it's on dark background, but maybe it's fine.
// The user said: "Secondary text Soft light blue/gray For example: #D8E5F3"
css = css.replace(/color: #7a92b0;/g, 'color: #D8E5F3;');
css = css.replace(/color: #a8c4e0;/g, 'color: #D8E5F3;');
css = css.replace(/color: #b4c8e1;/g, 'color: #D8E5F3;');
css = css.replace(/color: #8fa7c4;/g, 'color: #D8E5F3;');

// Wait, the nav-link hover should be red
css = css.replace(/\.nav-link:hover,\s*\n\.nav-link\.active\s*\{\s*color:\s*#D62828\s*!important;\s*\}/g, `.nav-link:hover,\n.nav-link.active {\n  color: #D62828 !important;\n}`);

fs.writeFileSync('public/style.css', css);
console.log('style.css updated successfully.');
