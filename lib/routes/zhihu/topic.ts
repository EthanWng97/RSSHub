import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import utils from './utils';
import { parseDate } from '@/utils/parse-date';
import g_encrypt from './execlib/x-zse-96-v3';
import md5 from '@/utils/md5';

export const route: Route = {
    path: '/topic/:topicId/:isTop?',
    categories: ['social-media'],
    example: '/zhihu/topic/19828946',
    parameters: { topicId: '话题 id', isTop: '仅精华，默认为否，其他值为是' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.zhihu.com/topic/:topicId/:type'],
            target: '/topic/:topicId',
        },
    ],
    name: '话题',
    maintainers: ['xyqfer'],
    handler,
};

async function handler(ctx) {
    const { topicId, isTop = false } = ctx.req.param();
    const link = `https://www.zhihu.com/topic/${topicId}/${isTop ? 'top-answers' : 'newest'}`;

    const cookieDc0 = await cache.tryGet('zhihu:cookies:d_c0', async () => {
        const { headers } = await got(link, {
            headers: {
                ...utils.header,
            },
        });
        const cookie = headers['set-cookie'].toString();
        const match = cookie.match(/d_c0=(\S+?)(?:;|$)/);
        const cookieMatched = match?.[1];
        if (!cookieMatched) {
            throw new Error('Failed to extract `d_c0` from cookies');
        }
        return cookieMatched;
    });
    const cookie = `d_c0=${cookieDc0}`;

    const topicMeta = await cache.tryGet(`zhihu:topic:${topicId}`, async () => {
        const { data: response } = await got(`https://www.zhihu.com/api/v4/topics/${topicId}/intro`, {
            searchParams: {
                include: 'content.meta.content.photos',
            },
        });
        return response;
    });

    const apiPath = `/api/v5.1/topics/${topicId}/feeds/${isTop ? 'top_activity' : 'timeline_activity'}`;
    const xzse93 = '101_3_3.0';
    const f = `${xzse93}+${apiPath}+${cookieDc0}`;
    const xzse96 = '2.0_' + g_encrypt(md5(f));
    const _header = { cookie, 'x-zse-96': xzse96, 'x-zse-93': xzse93 };

    const { data: response } = await got(`https://www.zhihu.com${apiPath}`, {
        headers: {
            ...utils.header,
            ..._header,
            Referer: link,
        },
    });

    const items = response.data.map(({ target: item }) => {
        const type = item.type;
        let title = '';
        let description = '';
        let link = '';
        let pubDate = '';
        let author = '';

        switch (type) {
            case 'answer':
                title = `${item.question.title}-${item.author.name}的回答：${item.excerpt}`;
                description = `<strong>${item.question.title}</strong><br>${item.author.name}的回答<br/>${utils.ProcessImage(item.content)}`;
                link = `https://www.zhihu.com/question/${item.question.id}/answer/${item.id}`;
                pubDate = parseDate(item.updated_time * 1000);
                author = item.author.name;
                break;

            case 'question':
                title = item.title;
                description = item.title;
                link = `https://www.zhihu.com/question/${item.id}`;
                pubDate = parseDate(item.created * 1000);
                break;

            case 'article':
                title = item.title;
                description = utils.ProcessImage(item.content);
                link = item.url;
                pubDate = parseDate(item.created * 1000);
                break;

            case 'zvideo':
                title = item.title;
                description = `${item.description}<br>
                <video controls poster="${item.video.thumbnail}" preload="metadata">
                    <source src="${item.video.playlist.fhd?.url ?? item.video.playlist.hd?.url ?? item.video.playlist.ld?.url ?? item.video.playlist.sd?.url}" type="video/mp4">
                </video>`;
                link = item.url;
                pubDate = parseDate(item.created_at * 1000);
                break;

            default:
                description = '未知类型，请点击<a href="https://github.com/DIYgod/RSSHub/issues">链接</a>提交issue';
        }

        return {
            title,
            description,
            author,
            pubDate,
            guid: item.id.toString(),
            link,
        };
    });

    return {
        title: `知乎话题-${topicId}-${isTop ? '精华' : '讨论'}`,
        description: topicMeta.content.introduction,
        link,
        item: items,
    };
}
