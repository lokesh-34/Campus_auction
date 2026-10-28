import { Listing, Notification, Question, SavedSearch, User } from '../models/index.js';
import { createNotification } from '../services/notificationService.js';
import { findDuplicateOrAnsweredMatch } from '../services/questionMatchingService.js';

// --- Questions & Answers ---
export async function askQuestion(req, res, next) {
  try {
    const { id: listingId } = req.params;
    const author = req.user;
    const { questionText } = req.body;

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Listing not found', code: 'NOT_FOUND' },
      });
    }

    // 1. Smart Duplicate / Prior Answer Detection for this auction
    const match = await findDuplicateOrAnsweredMatch(listingId, questionText);

    if (match) {
      // High-confidence match: Reuse seller's original answer immediately
      const question = await Question.create({
        listingId,
        authorId: author._id,
        questionText,
        answerText: match.answerText, // Verbatim original seller answer
        answeredAt: new Date(),
        status: 'ANSWERED',
        isAutoAnswered: true,
        matchedFromQuestionId: match.matchedQuestionId,
        autoAnswerConfidence: match.confidence,
      });

      await question.populate('authorId', 'displayName');

      return res.status(201).json({
        success: true,
        data: question,
        meta: {
          autoAnswered: true,
          reusedFrom: match.matchedQuestionId,
          confidence: match.confidence,
          message: 'Answered previously by the seller.',
        },
      });
    }

    // 2. No reliable match: Save OPEN question and notify seller
    const question = await Question.create({
      listingId,
      authorId: author._id,
      questionText,
      status: 'OPEN',
      isAutoAnswered: false,
    });

    await question.populate('authorId', 'displayName');

    // Notify seller
    createNotification({
      recipientId: listing.sellerId.toString(),
      type: 'NEW_QUESTION',
      listingId: listing._id.toString(),
      message: `New question on "${listing.title}": "${questionText}"`,
      data: {
        questionId: question._id.toString(),
        questionText,
      },
      eventKey: `question_${question._id}`,
    });

    res.status(201).json({
      success: true,
      data: question,
      meta: {
        autoAnswered: false,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function answerQuestion(req, res, next) {
  try {
    const { id: questionId } = req.params;
    const seller = req.user;
    const { answerText } = req.body;

    const question = await Question.findById(questionId).populate('listingId');
    if (!question) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Question not found', code: 'NOT_FOUND' },
      });
    }

    if (question.listingId.sellerId.toString() !== seller._id.toString()) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only the seller can answer questions on this listing', code: 'FORBIDDEN' },
      });
    }

    question.answerText = answerText;
    question.answeredAt = new Date();
    question.status = 'ANSWERED';
    await question.save();

    // Check if any other OPEN questions on this listing can be auto-answered now
    try {
      const pendingOpen = await Question.find({
        listingId: question.listingId._id,
        status: 'OPEN',
        _id: { $ne: question._id },
      });

      for (const openQ of pendingOpen) {
        const match = await findDuplicateOrAnsweredMatch(question.listingId._id, openQ.questionText);
        if (match && match.answerText) {
          openQ.answerText = match.answerText;
          openQ.answeredAt = new Date();
          openQ.status = 'ANSWERED';
          openQ.isAutoAnswered = true;
          openQ.matchedFromQuestionId = match.matchedQuestionId;
          openQ.autoAnswerConfidence = match.confidence;
          await openQ.save();
        }
      }
    } catch (e) {
      console.warn('Auto-resolving pending questions error:', e.message);
    }

    // Notify question author
    createNotification({
      recipientId: question.authorId.toString(),
      type: 'QUESTION_ANSWERED',
      listingId: question.listingId._id.toString(),
      message: `Seller answered your question on "${question.listingId.title}": "${answerText}"`,
      eventKey: `answered_${question._id}`,
    });

    res.json({
      success: true,
      data: question,
    });
  } catch (err) {
    next(err);
  }
}

export async function getListingQuestions(req, res, next) {
  try {
    const { id: listingId } = req.params;
    let questions = await Question.find({ listingId, status: { $ne: 'REMOVED' } })
      .populate('authorId', 'displayName')
      .sort({ createdAt: -1 });

    // Self-healing: Check if any OPEN questions can be auto-resolved from an existing answered question
    const hasAnswered = questions.some((q) => q.status === 'ANSWERED' && q.answerText);
    const hasOpen = questions.some((q) => q.status === 'OPEN');

    if (hasAnswered && hasOpen) {
      let updatedAny = false;
      for (const q of questions) {
        if (q.status === 'OPEN') {
          const match = await findDuplicateOrAnsweredMatch(listingId, q.questionText);
          if (match && match.answerText) {
            q.answerText = match.answerText;
            q.answeredAt = new Date();
            q.status = 'ANSWERED';
            q.isAutoAnswered = true;
            q.matchedFromQuestionId = match.matchedQuestionId;
            q.autoAnswerConfidence = match.confidence;
            await q.save();
            updatedAny = true;
          }
        }
      }
      if (updatedAny) {
        questions = await Question.find({ listingId, status: { $ne: 'REMOVED' } })
          .populate('authorId', 'displayName')
          .sort({ createdAt: -1 });
      }
    }

    res.json({
      success: true,
      data: questions,
    });
  } catch (err) {
    next(err);
  }
}

// --- Watchlists ---
export async function toggleWatchlist(req, res, next) {
  try {
    const { id: listingId } = req.params;
    const user = req.user;

    const isWatched = user.watchlist.some((id) => id.toString() === listingId.toString());

    if (isWatched) {
      user.watchlist = user.watchlist.filter((id) => id.toString() !== listingId.toString());
    } else {
      user.watchlist.push(listingId);
    }

    await user.save();

    res.json({
      success: true,
      data: {
        isWatched: !isWatched,
        watchlist: user.watchlist,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getWatchlist(req, res, next) {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'watchlist',
      populate: { path: 'sellerId', select: 'displayName stats' },
    });

    res.json({
      success: true,
      data: user.watchlist || [],
    });
  } catch (err) {
    next(err);
  }
}

// --- Notifications ---
export async function getNotifications(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ recipientId: req.user._id })
        .populate('listingId', 'title category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Notification.countDocuments({ recipientId: req.user._id }),
      Notification.countDocuments({ recipientId: req.user._id, isRead: false }),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientId: req.user._id },
      { isRead: true },
      { new: true }
    );

    res.json({
      success: true,
      data: notification,
    });
  } catch (err) {
    next(err);
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    await Notification.updateMany({ recipientId: req.user._id, isRead: false }, { isRead: true });

    res.json({
      success: true,
      data: { message: 'All notifications marked as read' },
    });
  } catch (err) {
    next(err);
  }
}

// --- Saved Searches ---
export async function createSavedSearch(req, res, next) {
  try {
    const { keyword, category, maxPricePaise, condition, notifyEnabled } = req.body;
    const saved = await SavedSearch.create({
      userId: req.user._id,
      keyword,
      category,
      maxPricePaise,
      condition,
      notifyEnabled,
    });

    res.status(201).json({
      success: true,
      data: saved,
    });
  } catch (err) {
    next(err);
  }
}

export async function getSavedSearches(req, res, next) {
  try {
    const searches = await SavedSearch.find({ userId: req.user._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: searches,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteSavedSearch(req, res, next) {
  try {
    const { id } = req.params;
    await SavedSearch.findOneAndDelete({ _id: id, userId: req.user._id });

    res.json({
      success: true,
      data: { message: 'Saved search deleted' },
    });
  } catch (err) {
    next(err);
  }
}
