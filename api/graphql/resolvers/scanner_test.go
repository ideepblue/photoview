package resolvers

import (
	"context"
	"testing"

	"github.com/photoview/photoview/api/test_utils"
	"github.com/stretchr/testify/assert"
)

func TestScanAlbumRejectsUnknownAlbum(t *testing.T) {
	db := test_utils.DatabaseTest(t)
	resolver := &mutationResolver{Resolver: &Resolver{database: db}}

	_, err := resolver.ScanAlbum(context.Background(), 9999, false, false)
	assert.ErrorContains(t, err, "get album from database")
}
