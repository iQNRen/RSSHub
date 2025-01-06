const got = require('@/utils/got');
const cheerio = require('cheerio');
const title = require('title');
const resolve_url = require('url').resolve;

const base_url = 'https://jyt.fujian.gov.cn';

const map = {
    zywj: '/xxgk/zywj/', // 重要文件
    gggs: '/xxgk/gggs/', // 公告公示
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
    // 并行处理所有链接
    const fetchTasks = Object.entries(map).map(async ([type, link]) => {
        let url = `${base_url}${link}`;
        const response = await got({
            method: 'get',
            url: url,
            headers: {
                Referer: url,
            },
        });
        const $ = cheerio.load(response.data);
        const timeList = $('.b-free-read-leaf').toArray().map(item => $(item).text().trim());
        const list = $('.list_base').toArray().map((item, index) => {
            const cheerioItem = $(item);
            const a = cheerioItem.find('a');
            let itemLink = a.attr('href');
            if (itemLink && !itemLink.startsWith('http')) {
                itemLink = resolve_url(`${base_url}${map[type]}`, itemLink);
            }
            return {
                title: a.text().trim() || '',
                link: itemLink,
                pubDate: new Date(timeList[index]),
                type: type,
            };
        }).filter(item => item.title && item.link);
        return list;
    });
    let items = await Promise.all(fetchTasks);
    // 扁平化数组并根据 pubDate 排序
    items = items.flat().sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    items = await Promise.all(
        items.map((item) =>
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
                console.log(newItem);
                return newItem;
            })
        )
    );

    ctx.state.data = {
        title: `福建省教育厅`,
        item: items,
    };
};
