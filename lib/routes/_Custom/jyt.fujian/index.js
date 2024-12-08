const got = require('@/utils/got');
const cheerio = require('cheerio');
const resolve_url = require('url').resolve;

const base_url = 'https://jyt.fujian.gov.cn';

const map = {
    zywj: '/xxgk/zywj/', // 重要文件
    gggs: '/xxgk/zywj/', // 公告公示
    zcjd: '/xxgk/zcjd/', // 政策解读
    rsxx: '/xxgk/rsxx/', // 人事信息
    jhzj: '/xxgk/jhzj/', // 计划总结
    czzj: '/xxgk/czzj/', // 通知公告
    tjsj: '/xxgk/tjsj/', // 统计数据
    zdjc: '/xxgk/zdjc/', // 重要政策
    jgdj: '/xxgk/jgdj/', // 机关党建
    xzzx: '/wsbs/xzzx/', // 下载中心
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

    const list = $('.list_base')
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
                    link = resolve_url(`${base_url}${map[type]}`, link);
                }
                const pubDate = new Date(cheerioItem.find('.b-free-read-leaf').text());

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
                newItem.description = $('.article_area').html() || '';
                return newItem;
            })
        )
    );

    ctx.state.data = {
        link,
        title: $('head > title').text(),
        item: items,
    };
};
