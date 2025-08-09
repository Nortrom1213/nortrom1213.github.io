# Minimalist Hugo Template for Academic Websites

This repository contains a [Hugo](https://github.com/gohugoio/hugo) template to create a personal academic website. The template uses the [PaperMod theme](https://github.com/adityatelange/hugo-PaperMod) but modifies it in various ways to be more minimalist and better suited for academic websites. The website is hosted on [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages).

## Documentation

The template is documented at https://pascalmichaillat.org/b/.

## Illustration

The website produced by the template can be viewed at https://pascalmichaillat.org/hugo-website/.

## Installation

### On your local machine

+ Install [Hugo](https://gohugo.io/installation/). On a Mac, this can be done with [Homebrew](https://brew.sh): run `brew install hugo` in the terminal. If you already have Hugo but it is outdated, run `brew upgrade hugo`.
+ Since the website is hosted on GitHub Pages, it is convenient to install [GitHub Desktop](https://desktop.github.com). The website can be updated from your local machine via GitHub Desktop without going to GitHub.
+ Clone the template repository to your local machine. This can be done in two steps:
	1. Click "Use this template" and then "Create a new repository" at the top of the repository.
	2. Once the new repository is created on your GitHub account, open GitHub Desktop and click "File" and then "Clone repository". Find the newly created repository under the "GitHub.com" tab and clone it.
+ Update the `baseURL` parameter in `config.yml` with the website URL that you plan to use. By default the URL is `https://username.github.io`.

### On your GitHub account

+ The first time that you push your repository to GitHub, you need to allow GitHub Actions and GitHub Pages so the website can be built and deployed to GitHub Pages.
+ The first step is to [ask GitHub to publish the website with a GitHub Action](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow). GitHub offers a ready-made action to publish a Hugo website, called `Deploy Hugo site to Pages`. This action must be enabled in the [Pages Settings](https://github.com/pmichaillat/hugo-website/settings/pages) of your GitHub repository. You can view the workflow triggered by the action in the `.github/workflows/hugo.yml` file.
+ Once the GitHub Actions are enabled, GitHub will build and publish the website as soon as the repository is updated. 
+ If you would like to update the deployment action (for instance because it became outdated and fails to deploy the site), you can find the [most recent action on GitHub]( https://github.com/actions/starter-workflows/blob/main/pages/hugo.yml). You can place this file directly in the `.github/workflows` folder to replace the old `hugo.yml` file—but make sure to set `push: branches` to `["main"]`.

## Usage

### Local development

Navigate to the website directory (`cd`) and run in the terminal:

```bash
hugo server
```

The command builds the website on your machine and makes it available at http://localhost:1313, rebuilding automatically as you edit. You can modify the content of the repository and develop your website entirely on your machine.

### Online deployment

Once your website is ready to be made public, commit your content and template changes and push them to the website repository on GitHub. It is convenient to use GitHub Desktop for this Git operation.

On each push, the [GitHub Actions workflow](https://github.com/pmichaillat/hugo-website/actions/workflows/hugo.yml) invokes Hugo to generate the website and deploys the output to [GitHub Pages](https://github.com/pmichaillat/hugo-website/deployments/github-pages). During the workflow, Hugo processes your content, templates, and other project files and generates a static website.

## Software

+ The website is built with Hugo v0.147.2 via GitHub Actions.
+ The website was developed locally with Hugo v0.147.2 on macOS Sequoia. 
+ The website was tested on the following browsers:
	+ Safari 18.4 on macOS Sequoia
	+ Mobile Safari on iOS 18  
+ Other Hugo versions, operating systems, and web browsers may require minor adjustments. Please [report any issues](https://github.com/pmichaillat/hugo-website/issues) to help improve compatibility.

## License

This repository is licensed under the [MIT License](LICENSE.md).
