const got = require('@/utils/got');
const cheerio = require('cheerio');

const base_url = 'https://www.gdzz.gov.cn';

const map = {
    '公务员录用': '/gwygz/lypytzgg/', // 公务员录用
    '通知公告': '/tzgg/', // 通知公告
};

module.exports = async (ctx) => {
    // 并行处理所有链接
    const fetchTasks = Object.entries(map).map(async ([type, link]) => {
        const response = await got.get(`${base_url}${link}`);
        const $ = cheerio.load(response.data);
        const list = $('.clearfix').toArray().map((item) => {
            const cheerioItem = $(item);
            const a = cheerioItem.find('a');

            try {
                const title = `[${type}]-` + a.attr('title') || '';
                let link = a.attr('href');
                const pubDate = new Date(cheerioItem.find('.time, .right').text()).toLocaleString();

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
        }).filter((item) => item.title && item.link);
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
                    type: item.type,
                    description: '',
                };
                const response = await got.get(item.link);
                const $ = cheerio.load(response.data);
                newItem.description = $('.zw').html() || '';
                return newItem;
            })
        )
    );

    // 构建最终的输出
    ctx.state.data = {
        title: '广东公务员',
        item: items,
    };
};