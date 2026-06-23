class Gitflic < Formula
  desc "Zero-dependency CLI for the full GitFlic REST API (gitflic.ru)"
  homepage "https://cli-gitflic.ru"
  # Points at the immutable npm tarball. Bump `url` + `sha256` on every release
  # (scripts/publish.mjs --bump-formula does this for you after `npm publish`).
  url "https://registry.npmjs.org/gitflic-cli/-/gitflic-cli-0.3.5.tgz"
  # placeholder — `node scripts/publish.mjs --bump-formula` fills the real hash
  sha256 "51d971affaebd2eb0be78c6b8ba54f363c5a39ad619045519cc08dd1383ff2bd"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "gitflic", shell_output("#{bin}/gitflic help")
  end
end
