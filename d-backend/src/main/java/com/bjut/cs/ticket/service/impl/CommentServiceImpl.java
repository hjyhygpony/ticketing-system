package com.bjut.cs.ticket.service.impl;

import com.bjut.cs.ticket.entity.Comment;
import com.bjut.cs.ticket.mapper.CommentMapper;
import com.bjut.cs.ticket.service.ICommentService;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

/**
 * <p>
 *  服务实现类
 * </p>
 *
 * @author D
 * @since 2026-07-10
 */
@Service
public class CommentServiceImpl extends ServiceImpl<CommentMapper, Comment> implements ICommentService {

}
