const got = require('@/utils/got');
const cheerio = require('cheerio');
const resolve_url = require('url').resolve;

const base_url = 'https://www.qztc.edu.cn';

const map = {
    xw: '/xw/list.htm', // 泉师新闻
    2094: '/2094/list.htm', // 通知公告
    2095: '/2095/list.htm', // 采购公告
    xszx: '/xszx/list.htm', // 学术资讯
    2226: '/2226/list.htm', // 招聘信息
};

const feedIdMap = {
    xw: '7616571688992300c72bbbf4fd23447e688e8bf04730f7ec78c251232', // 泉师新闻
    2094: '/2094/list.htm', // 通知公告
    2095: '/2095/list.htm', // 采购公告
    xszx: '/xszx/list.htm', // 学术资讯
    2226: '/2226/list.htm', // 招聘信息
};

module.exports = async (ctx) => {
    const type = ctx.params.type;
    const link = `${base_url}${map[type]}`;

    const response = await got({
        method: 'get',
        url: link,
        headers: {
            Referer: link,
        },
    });

    const $ = cheerio.load(response.data);

    const list = $('.news.clearfix')
        .toArray()
        .map((item) => {
            const cheerioItem = $(item);
            const a = cheerioItem.find('a');

            try {
                const title = a.attr('title') || '';
                let link = a.attr('href');
                if (!link) {
                    link = '';
                } else if (!link.startsWith('http')) {
                    link = resolve_url(base_url, link);
                }
                const pubDate = new Date(cheerioItem.find('.news_meta').text());

                return {
                    title,
                    link,
                    pubDate,
                };
            } catch {
                return {
                    title: '',
                    link: '',
                    pubDate: new Date(),
                };
            }
        })
        .filter((item) => item.title && item.link);

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const newItem = {
                    ...item,
                    description: '',
                };
                const response = await got({
                    method: 'get',
                    url: item.link,
                    headers: {
                        Referer: item.link,
                    },
                });
                const $ = cheerio.load(response.data);
                newItem.description = $('.wp_articlecontent').html() || '';
                return newItem;
            })
        )
    );

    ctx.state.data = {
        link,
        title: $('head > title').text() + ' - 泉州师范学院-首页',
        description: `feedId:${feedIdMap[type]}+userId:44386223835065344`,
        item: items,
    };
};
