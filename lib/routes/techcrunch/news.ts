import { Route } from '@/types';
import cache from '@/utils/cache';
import parser from '@/utils/rss-parser';
import got from '@/utils/got';
import { load } from 'cheerio';
const host = 'https://techcrunch.com';
export const route: Route = {
    path: '/news',
    categories: ['new-media'],
    example: '/techcrunch/news',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['techcrunch.com/'],
        },
    ],
    name: 'News',
    maintainers: ['EthanWng97'],
    handler,
    url: 'techcrunch.com/',
};

async function handler() {
    const rssUrl = `${host}/feed/`;
    const feed = await parser.parseURL(rssUrl);
    const items = await Promise.all(
        feed.items.map((item) =>
            cache.tryGet(item.link, async () => {
                const url = item.link;
                const response = await got({
                    url,
                    method: 'get',
                });
                const html = response.data;
                const $ = load(html);
                const description = $('.single-post__container');
                description.find('.social-share').remove();
                description.find('.wp-block-query').remove();
                description.find('.wp-block-tc23-newsletter-signup-compact').remove();
                description.find('.wp-block-heading').remove();
                description.find('.single-post-hero__meta').remove();
                description.find('.wp-block-tenup-post-primary-term').remove();
                description.find('.wp-block-post-title').remove();
                description.find('.wp-block-post-terms').remove();
                return {
                    title: item.title,
                    pubDate: item.pubDate,
                    link: item.link,
                    category: item.categories,
                    description: description.html(),
                };
            })
        )
    );

    return {
        title: 'TechCrunch',
        link: host,
        description: 'Reporting on the business of technology, startups, venture capital funding, and Silicon Valley.',
        item: items,
    };
}
