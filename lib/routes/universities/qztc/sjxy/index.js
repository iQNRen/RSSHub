const got = require('@/utils/got');
const cheerio = require('cheerio');
const resolve_url = require('url').resolve;

const base_url = 'https://www.qztc.edu.cn/sjxy';

const map = {
    1938: '/1938/list.htm', // 学院概况
    1939: '/1939/list.htm', // 学院动态
    1940: '/1940/list.htm', // 学科建设
    1941: '/1941/list.htm', // 教学教务
    1942: '/1942/list.htm', // 人才培养
    1943: '/1943/list.htm', // 科研工作
    1944: '/1944/list.htm', // 党群工作
    1945: '/1945/list.htm', // 团学工作
    1947: '/1947/list.htm', // 资料下载
    1948: '/1948/list.htm', // 采购信息
    xxgk: '/xxgk/list.htm', // 信息公开
    // '1949': '/1949/list.htm', // 学院简介
    // '1950': '/1950/list.htm', // 学院领导
    // '1951': '/1951/list.htm', // 组织机构
};

const feedIdMap = {
    1938: '76191547011766272', // 学院概况
    1939: '76191636799793152', // 学院动态
    1940: '76191716012557312', // 学科建设
    1941: '76191801606580224', // 教学教务
    1942: '76191883508621312', // 人才培养
    1943: '76191969073985536', // 科研工作
    1944: '76192052719560704', // 党群工作
    1945: '76192131069026304', // 团学工作
    1947: '76192195866100736', // 资料下载
    1948: '76192273816320000', // 采购信息
    xxgk: '76192398572618752', // 信息公开
    // '1949': '/1949/list.htm', // 学院简介
    // '1950': '/1950/list.htm', // 学院领导
    // '1951': '/1951/list.htm', // 组织机构
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
                if (new URL(item.link).hostname === 'www.qztc.edu.cn') {
                    if (new URL(item.link).pathname.startsWith('/_upload')) {
                        // 链接为一个文件，直接返回链接
                        newItem.description = item.link;
                    } else {
                        const response = await got({
                            method: 'get',
                            url: item.link,
                            headers: {
                                Referer: item.link,
                            },
                        });
                        const $ = cheerio.load(response.data);
                        newItem.description = $('.wp_articlecontent').html() || '';
                    }
                } else {
                    // 涉及到其他站点，不方便做统一的 html 解析，直接返回链接
                    newItem.description = item.link;
                }
                return newItem;
            })
        )
    );

    ctx.state.data = {
        link,
        title: $('head > title').text() + ' - 泉州师范学院-数学与计算机科学学院 软件学院',
        description: `feedId:${feedIdMap[type]}+userId:44386223835065344`,
        item: items,
    };
};
